"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/app/actions/auth";
import { createEmbedding } from "@/lib/openai";

/**
 * note_links 表建议结构（你如果已经建好了就不用管）：
 * - user_id uuid
 * - from_note_id uuid   (这里我们用作 left_note_id)
 * - to_note_id uuid     (这里我们用作 right_note_id)
 * - score float4
 * - link_type text
 *
 * 并且有唯一约束（你之前应该已经加过）：
 * unique(user_id, from_note_id, to_note_id)
 */

/** 把一对 noteId 规范化成“无向边”：left < right */
function normalizePair(a: string, b: string) {
  return a < b ? { left: a, right: b } : { left: b, right: a };
}

/**
 * 为某条 note 自动创建“相关笔记链接”
 * - 默认连 5 条
 * - 默认阈值 0.35
 * - link_type = "semantic"
 * - sameBookOnly: true 只在同一本书里找；false 全库找
 */
export async function autoLinkNote(params: {
  noteId: string;
  content: string;
  quote?: string | null;
  pageRef?: string | null;
  matchCount?: number;
  threshold?: number;
  sameBookOnly?: boolean;
}) {
  const user = await requireUser();
  const supabase = await createSupabaseServer();

  const matchCount = params.matchCount ?? 5;
  const threshold = params.threshold ?? 0.35;
  const sameBookOnly = params.sameBookOnly ?? false;

  // 1) 拼 embedding 输入
  const text = [params.content, params.quote ? `Quote: ${params.quote}` : "", params.pageRef ? `Page: ${params.pageRef}` : ""]
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!text) {
    return { ok: false as const, message: "Empty text for embedding." };
  }

  // 2) 生成 query embedding（Supabase vector 输入：字符串形式 "[0.1,0.2,...]" 最稳）
  const embedding = await createEmbedding(text);
  const queryEmbedding = `[${embedding.join(",")}]`;

  // 3) 找到“候选相似 notes”
  // 这里调用你 Step 3 已经做好的 RPC：match_notes
  // 约定：RPC 内部必须按 p_user_id 过滤 user_id
  // 可选：传 p_same_book_only + p_book_id（如果你还没加这个参数，下面会自动退化为全库）
  let data: any[] | null = null;
  let rpcError: any = null;

  if (sameBookOnly) {
    // 如果 sameBookOnly=true，我们尝试先查这条 note 的 book_id
    const { data: noteRow, error: noteErr } = await supabase
      .from("notes")
      .select("id, book_id")
      .eq("id", params.noteId)
      .eq("user_id", user.id)
      .single();

    if (noteErr || !noteRow?.book_id) {
      // 拿不到 book_id 就退化为全库
      const res = await supabase.rpc("match_notes", {
        p_user_id: user.id,
        query_embedding: queryEmbedding,
        match_count: matchCount + 8,
        match_threshold: threshold,
      });
      data = res.data ?? null;
      rpcError = res.error;
    } else {
      // 尝试带 book_id 过滤（前提：你的 RPC 支持 p_book_id / p_same_book_only）
      const res = await supabase.rpc("match_notes", {
        p_user_id: user.id,
        query_embedding: queryEmbedding,
        match_count: matchCount + 8,
        match_threshold: threshold,
        p_book_id: noteRow.book_id,
        p_same_book_only: true,
      });
      // 如果 RPC 不支持这些参数，一般会报错，我们就退化为全库
      if (res.error) {
        const fallback = await supabase.rpc("match_notes", {
          p_user_id: user.id,
          query_embedding: queryEmbedding,
          match_count: matchCount + 8,
          match_threshold: threshold,
        });
        data = fallback.data ?? null;
        rpcError = fallback.error;
      } else {
        data = res.data ?? null;
        rpcError = null;
      }
    }
  } else {
    const res = await supabase.rpc("match_notes", {
      p_user_id: user.id,
      query_embedding: queryEmbedding,
      match_count: matchCount + 8, // 多取一些，后面要排除自己 + 去重
      match_threshold: threshold,
    });
    data = res.data ?? null;
    rpcError = res.error;
  }

  if (rpcError) {
    return { ok: false as const, message: rpcError.message ?? "match_notes failed" };
  }

  const candidates = (data ?? []).filter((r: any) => r?.id && r.id !== params.noteId);

  // 4) 去重：同一个对儿只保留一个（无向边 + Map）
  const seen = new Map<string, { left: string; right: string; score: number }>();

  for (const r of candidates) {
    const otherId = String(r.id);
    const { left, right } = normalizePair(params.noteId, otherId);
    const key = `${left}__${right}`;
    const score = Number(r.similarity ?? r.score ?? 0);

    // 同一对儿如果出现多次，保留 score 更高的
    const prev = seen.get(key);
    if (!prev || score > prev.score) {
      seen.set(key, { left, right, score });
    }
  }

  // 取 top matchCount
  const top = Array.from(seen.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, matchCount);

  if (top.length === 0) return { ok: true as const, inserted: 0 };

  // 5) 写入 note_links（无向边：from_note_id=left, to_note_id=right）
  const rows = top.map((x) => ({
    user_id: user.id,
    from_note_id: x.left,
    to_note_id: x.right,
    score: x.score,
    link_type: "semantic",
  }));

  const { error: upsertErr } = await supabase.from("note_links").upsert(rows, {
    onConflict: "user_id,from_note_id,to_note_id",
  });

  if (upsertErr) return { ok: false as const, message: upsertErr.message };

  return { ok: true as const, inserted: rows.length };
}

/**
 * 读取某条 note 的相关笔记（无向边）
 * - 会同时查：from_note_id = noteId OR to_note_id = noteId
 * - 然后把“另一端”的 id 作为 relatedId
 */
export async function getRelatedNotes(noteId: string) {
  const user = await requireUser();
  const supabase = await createSupabaseServer();

  // 1) 先拿链接：to_note_id + score
  const { data: links, error: linkErr } = await supabase
    .from("note_links")
    .select("to_note_id, score")
    .eq("user_id", user.id)
    .eq("from_note_id", noteId)
    .order("score", { ascending: false })
    .limit(10);

  if (linkErr) {
    return { ok: false as const, message: linkErr.message, results: [] as any[] };
  }

  const ids = (links ?? [])
    .map((l: any) => l.to_note_id)
    .filter(Boolean);

  if (ids.length === 0) {
    return { ok: true as const, results: [] as any[] };
  }

  // 2) 把 score 做成 Map，方便挂回每条 note
  const scoreById = new Map<string, number>();
  for (const l of links ?? []) {
    if (l?.to_note_id) scoreById.set(l.to_note_id, Number(l.score ?? 0));
  }

  // 3) 批量查 notes 详情
  const { data: notes, error: notesErr } = await supabase
    .from("notes")
    .select("id, book_id, content, page_ref, quote, topics, keywords, created_at")
    .eq("user_id", user.id)
    .in("id", ids);

  if (notesErr) {
    return { ok: false as const, message: notesErr.message, results: [] as any[] };
  }

  // 4) 按 ids 的顺序返回，并把 score 挂上去（供 page.tsx 用 r.score）
  const byId = new Map((notes ?? []).map((n: any) => [n.id, n]));
  const results = ids
    .map((id) => {
      const n = byId.get(id);
      if (!n) return null;
      return { ...n, score: scoreById.get(id) ?? 0 };
    })
    .filter(Boolean);

  return { ok: true as const, results };
}