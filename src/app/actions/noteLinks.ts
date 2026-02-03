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
 * 并且有唯一约束：
 * unique(user_id, from_note_id, to_note_id)
 */

/** 把一对 noteId 规范化成“无向边”：left < right */
function normalizePair(a: string, b: string) {
  return a < b ? { left: a, right: b } : { left: b, right: a };
}

/**
 * ✅ Step 2: 最稳的 shared concepts 计算（纯规则，不用 AI）
 * - 只做英文/数字/术语的“关键词”抽取（中文暂不做复杂分词，后续可升级）
 * - 产出数组：["debt","credit","cycle",...]
 */
function extractConcepts(text: string) {
  const raw = text || "";

  // ---------- 1) 英文/数字术语 ----------
  const lower = raw.toLowerCase();
  const englishTokens = lower
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .split(/[\s-]+/g)
    .filter(Boolean);

  const enStop = new Set([
    "the","a","an","and","or","to","of","in","on","for","with","as","is","are","was","were",
    "be","been","it","this","that","these","those","at","by","from","but","not","we","you","i",
  ]);

  const english: string[] = [];
  for (const w of englishTokens) {
    if (w.length < 3) continue;
    if (enStop.has(w)) continue;
    if (/^\d+$/.test(w)) continue;
    // 纯中文交给中文逻辑
    if (/^[\p{Script=Han}]+$/u.test(w)) continue;
    english.push(w);
  }

  // ---------- 2) 中文“概念短语” ----------
  // 只保留汉字，避免符号干扰
  const han = raw.replace(/[^\p{Script=Han}]+/gu, "");
  const s = han.slice(0, 900);

  // 常见虚词/结构词（让“的钱/的债务”这类直接出局）
  const cnStopSingle = new Set(["的","了","在","把","对","与","及","和","或","而","也","就","都","很","更","不","没","被","这","那","一个","一种"]);
  const cnStopPhrases = new Set(["因此","所以","但是","因为","如果","同时","开始","出现","越来越","由于","以及"]);

  // 生成 2~6 字片段，但更偏好 3~6（更像“概念”）
  const grams: string[] = [];
  for (let n = 2; n <= 6; n++) {
    for (let i = 0; i + n <= s.length; i++) {
      const g = s.slice(i, i + n);

      // 过滤：全重复（哈哈哈 / 呵呵）
      if (/^(.)\1+$/.test(g)) continue;

      // 过滤：包含虚词（只要出现“的/了/在”等，直接不要）
      let bad = false;
      for (const ch of g) {
        if (cnStopSingle.has(ch)) { bad = true; break; }
      }
      if (bad) continue;

      // 过滤：常见套话短语
      if (cnStopPhrases.has(g)) continue;

      // 过滤：以“的”开头/结尾（防止 “的钱” “债务的”）
      if (g.startsWith("的") || g.endsWith("的")) continue;

      grams.push(g);
    }
  }

  // ---------- 3) 统计 + 让“更像概念的短语”优先 ----------
  // 思路：长度越长越像概念；出现次数越多越重要；英文术语也很重要
  const score = new Map<string, number>();

  // 英文术语加权（+6）
  for (const w of english) {
    score.set(w, (score.get(w) ?? 0) + 6);
  }

  // 中文短语：按长度加权（2字+1，3字+3，4字+5，5字+7，6字+8）
  for (const g of grams) {
    const n = g.length;
    const w =
      n === 2 ? 1 :
      n === 3 ? 3 :
      n === 4 ? 5 :
      n === 5 ? 7 : 8;
    score.set(g, (score.get(g) ?? 0) + w);
  }

  // ---------- 4) 去掉“被包含的短语”，保留更完整的概念 ----------
  // 例如同时有 “债务” 和 “债务危机”，优先保留 “债务危机”
  const ranked = [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);

  const kept: string[] = [];
  for (const k of ranked) {
    // 太短的中文（1字）不可能出现，但保险
    if (/^[\p{Script=Han}]+$/u.test(k) && k.length < 2) continue;

    // 如果 k 被已保留的更长概念包含，就跳过
    const contained = kept.some((p) => p.length >= k.length && p.includes(k));
    if (contained) continue;

    kept.push(k);
    if (kept.length >= 40) break;
  }

  return kept;
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
  const text = [
    params.content,
    params.quote ? `Quote: ${params.quote}` : "",
    params.pageRef ? `Page: ${params.pageRef}` : "",
  ]
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

      // 如果 RPC 不支持这些参数 => 退化为全库
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
    return {
      ok: false as const,
      message: rpcError.message ?? "match_notes failed",
    };
  }

  const candidates = (data ?? []).filter(
    (r: any) => r?.id && r.id !== params.noteId
  );

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
 * 读取某条 note 的相关笔记（按“无向边”展示）
 * - 同时查：from_note_id = noteId OR to_note_id = noteId
 * - 对每条 link 取“另一端”的 note id
 * - 去重：同一个 relatedId 可能出现两次，取更高的 score
 * - 最终按 score 倒序返回
 *
 * ✅ Step 2: 增加 shared_concepts（关键词交集）
 */
export async function getRelatedNotes(noteId: string) {
  const user = await requireUser();
  const supabase = await createSupabaseServer();

  // 0) 查当前 note 的文本（用于计算 shared concepts）
  const { data: baseNote, error: baseErr } = await supabase
    .from("notes")
    .select("content, quote, page_ref")
    .eq("user_id", user.id)
    .eq("id", noteId)
    .single();

  if (baseErr) {
    return { ok: false as const, message: baseErr.message, results: [] as any[] };
  }

  const baseAllText = [
    baseNote?.content ?? "",
    baseNote?.quote ?? "",
    baseNote?.page_ref ?? "",
  ]
    .filter(Boolean)
    .join("\n");

  const baseConcepts = new Set(extractConcepts(baseAllText));

  // 1) 先拿链接：同时包含 from/to，方便算“另一端”
  const { data: links, error: linkErr } = await supabase
    .from("note_links")
    .select("from_note_id, to_note_id, score")
    .eq("user_id", user.id)
    .or(`from_note_id.eq.${noteId},to_note_id.eq.${noteId}`)
    .order("score", { ascending: false })
    .limit(30);

  if (linkErr) {
    return { ok: false as const, message: linkErr.message, results: [] as any[] };
  }

  // 2) 提取“另一端”的 id，并去重（同一个 relatedId 取最高分）
  const bestScoreByRelatedId = new Map<string, number>();

  for (const l of links ?? []) {
    const from = String((l as any).from_note_id || "");
    const to = String((l as any).to_note_id || "");
    if (!from || !to) continue;

    const relatedId = from === noteId ? to : from;
    if (!relatedId || relatedId === noteId) continue;

    const s = Number((l as any).score ?? 0);
    const prev = bestScoreByRelatedId.get(relatedId);
    if (prev == null || s > prev) bestScoreByRelatedId.set(relatedId, s);
  }

  // 3) top 10 related ids（按 score 倒序）
  const ids = Array.from(bestScoreByRelatedId.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id);

  if (ids.length === 0) {
    return { ok: true as const, results: [] as any[] };
  }

  // 4) 批量查 related notes 详情
  // ⚠️ 仍然不 select topics/keywords，避免你库里没有这些列导致报错。
  const { data: notes, error: notesErr } = await supabase
    .from("notes")
    .select("id, book_id, content, page_ref, quote, created_at")
    .eq("user_id", user.id)
    .in("id", ids);

  if (notesErr) {
    return { ok: false as const, message: notesErr.message, results: [] as any[] };
  }

  // 5) 组装结果：按 ids 顺序 + score + shared_concepts
  const byId = new Map((notes ?? []).map((n: any) => [n.id, n]));

  const results = ids
    .map((id) => {
      const n = byId.get(id);
      if (!n) return null;

      const relatedText = [n.content ?? "", n.quote ?? "", n.page_ref ?? ""]
        .filter(Boolean)
        .join("\n");

      const relatedConcepts = extractConcepts(relatedText);

      // 交集（最多 6 个）
      const shared = relatedConcepts.filter((c) => baseConcepts.has(c)).slice(0, 6);

      return {
        ...n,
        score: bestScoreByRelatedId.get(id) ?? 0,
        shared_concepts: shared,
      };
    })
    .filter(Boolean);

  return { ok: true as const, results };
}