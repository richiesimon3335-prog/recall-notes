"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/app/actions/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createEmbedding } from "@/lib/openai";
import { autoLinkNote } from "@/app/actions/noteLinks";
import { bumpCreateNoteUsageOrThrow } from "@/app/actions/usage/bumpCreateNoteUsageOrThrow";

/**
 * Create a note (server action)
 * - Validate input
 * - Daily limit check (before any write)
 * - Insert note
 * - Best-effort: generate embedding and write back
 * - Best-effort: auto-link related notes
 * - Redirect back to book page (with error message if any)
 */
export async function createNote(formData: FormData) {
  const user = await requireUser();
  const supabase = await createSupabaseServer();

  // 1) Read form fields first (so we can redirect back to the right page)
  const bookId = String(formData.get("book_id") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();

  const pageRefRaw = formData.get("page_ref");
  const quoteRaw = formData.get("quote");

  const pageRef = pageRefRaw ? String(pageRefRaw).trim() : "";
  const quote = quoteRaw ? String(quoteRaw).trim() : "";

  // checkbox: checked -> "on"
  const sameBookOnly = formData.get("sameBookOnly") === "on";

  // 2) Basic validation (before limit check)
  if (!bookId) {
    redirect(`/books?error=${encodeURIComponent("缺少 book_id")}`);
  }
  if (!content) {
    redirect(
      `/books/${bookId}?error=${encodeURIComponent("请输入内容（content）")}`
    );
  }

// ✅ 长度限制（先拦截，避免计入 daily usage / 避免写库 / 避免 OpenAI 成本）
const CONTENT_MAX = 1200;
const QUOTE_MAX = 600;
const PAGE_REF_MAX = 40;

if (content.length > CONTENT_MAX) {
  redirect(
    `/books/${bookId}?error=${encodeURIComponent(
      `Content 过长：最多 ${CONTENT_MAX} 字，你现在是 ${content.length} 字。请缩短后再提交 🙂`
    )}`
  );
}

if (quote && quote.length > QUOTE_MAX) {
  redirect(
    `/books/${bookId}?error=${encodeURIComponent(
      `Quote 过长：最多 ${QUOTE_MAX} 字，你现在是 ${quote.length} 字。请缩短后再提交 🙂`
    )}`
  );
}

if (pageRef && pageRef.length > PAGE_REF_MAX) {
  redirect(
    `/books/${bookId}?error=${encodeURIComponent(
      `Page Ref 过长：最多 ${PAGE_REF_MAX} 字，你现在是 ${pageRef.length} 字。请缩短后再提交 🙂`
    )}`
  );
}

  // ✅ 3) Daily Create Note limit (MUST be before any write)
  const usage = await bumpCreateNoteUsageOrThrow({
    supabase,
    userId: user.id,
  });

  // ✅ IMPORTANT: 超限不要 return，直接 redirect（这样 UI 一定能显示提示）
  if (!usage.ok) {
    redirect(
      `/books/${bookId}?error=${encodeURIComponent(
        usage.message || "今日新增笔记次数已达上限，请明天再来 🙂"
      )}`
    );
  }

  // 4) Insert note
  const { data: inserted, error: insertErr } = await supabase
    .from("notes")
    .insert({
      user_id: user.id,
      book_id: bookId,
      content,
      page_ref: pageRef || null,
      quote: quote || null,
    })
    .select("id")
    .single();

  if (insertErr || !inserted?.id) {
    redirect(
      `/books/${bookId}?error=${encodeURIComponent(
        insertErr?.message || "创建笔记失败"
      )}`
    );
  }

  const noteId = inserted.id as string;

  // 5) Best-effort: generate embedding and write back
  try {
    const textForEmbedding = [
      content,
      quote ? `Quote: ${quote}` : "",
      pageRef ? `Page: ${pageRef}` : "",
    ]
      .filter(Boolean)
      .join("\n")
      .trim();

    if (textForEmbedding) {
      const embedding = await createEmbedding(textForEmbedding);
      const embeddingStr = `[${embedding.join(",")}]`;

      const { error: updateErr } = await supabase
        .from("notes")
        .update({ embedding: embeddingStr })
        .eq("id", noteId)
        .eq("user_id", user.id);

      if (updateErr) {
        console.error("Embedding DB update error:", updateErr);
      }
    }
  } catch (e: any) {
    console.error("Embedding generation failed:", e?.message || e);
  }

  // 6) Best-effort: auto-link notes
  try {
    await (autoLinkNote as any)({
      noteId,
      content,
      quote: quote || undefined,
      pageRef: pageRef || undefined,
      matchCount: 5,
      threshold: 0.35,
      sameBookOnly,
      bookId,
    });
  } catch (e: any) {
    console.error("Auto link failed:", e?.message || e);
  }

  // 7) Back to book page
  redirect(`/books/${bookId}`);
}

/**
 * List notes by book (used by /books/[id] page)
 */
export async function listNotesByBook(bookId: string) {
  const user = await requireUser();
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from("notes")
    .select("id, book_id, user_id, content, page_ref, quote, created_at")
    .eq("user_id", user.id)
    .eq("book_id", bookId)
    .order("created_at", { ascending: false });

  if (error) {
    return { ok: false as const, message: error.message, data: [] as any[] };
  }
  return { ok: true as const, data: data ?? [] };
}

/**
 * Get single note (used by /notes/[id] page)
 */
export async function getNote(noteId: string) {
  const user = await requireUser();
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from("notes")
    .select(
      "id, user_id, book_id, content, page_ref, quote, topics, keywords, created_at"
    )
    .eq("user_id", user.id)
    .eq("id", noteId)
    .single();

  if (error) {
    return { ok: false as const, message: error.message };
  }
  return { ok: true as const, data };
}