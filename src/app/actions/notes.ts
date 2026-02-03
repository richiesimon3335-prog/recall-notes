"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/app/actions/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createEmbedding } from "@/lib/openai";
import { autoLinkNote } from "@/app/actions/noteLinks";
import { bumpCreateNoteUsageOrThrow } from "@/app/actions/usage/bumpCreateNoteUsageOrThrow";

/**
 * Shared limits
 */
const CONTENT_MAX = 1200;
const QUOTE_MAX = 600;
const PAGE_REF_MAX = 40;

function enc(msg: string) {
  return encodeURIComponent(msg);
}

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
    redirect(`/books?error=${enc("缺少 book_id")}`);
  }
  if (!content) {
    redirect(`/books/${bookId}?error=${enc("请输入内容（content）")}`);
  }

  // ✅ Length guards: avoid daily usage / DB write / OpenAI cost
  if (content.length > CONTENT_MAX) {
    redirect(
      `/books/${bookId}?error=${enc(
        `Content 过长：最多 ${CONTENT_MAX} 字，你现在是 ${content.length} 字。请缩短后再提交 🙂`
      )}`
    );
  }
  if (quote && quote.length > QUOTE_MAX) {
    redirect(
      `/books/${bookId}?error=${enc(
        `Quote 过长：最多 ${QUOTE_MAX} 字，你现在是 ${quote.length} 字。请缩短后再提交 🙂`
      )}`
    );
  }
  if (pageRef && pageRef.length > PAGE_REF_MAX) {
    redirect(
      `/books/${bookId}?error=${enc(
        `Page Ref 过长：最多 ${PAGE_REF_MAX} 字，你现在是 ${pageRef.length} 字。请缩短后再提交 🙂`
      )}`
    );
  }

  // ✅ 3) Daily Create Note limit (MUST be before any write)
  const usage = await bumpCreateNoteUsageOrThrow({
    supabase,
    userId: user.id,
  });

  if (!usage.ok) {
    redirect(
      `/books/${bookId}?error=${enc(
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
      same_book_only: sameBookOnly,
    })
    .select("id")
    .single();

  if (insertErr || !inserted?.id) {
    redirect(
      `/books/${bookId}?error=${enc(insertErr?.message || "创建笔记失败")}`
    );
  }

  const noteId = inserted.id as string;

  // 5) Best-effort: embedding
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

      if (updateErr) console.error("Embedding DB update error:", updateErr);
    }
  } catch (e: any) {
    console.error("Embedding generation failed:", e?.message || e);
  }

  // 6) Best-effort: auto-link
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
 * ✅ Update a note (server action)
 * - Validate input
 * - Update note fields: content/page_ref/quote/same_book_only
 * - Best-effort: regenerate embedding
 * - Best-effort: rebuild semantic links (delete old -> rebuild)
 * - Redirect back to note detail page
 */
export async function updateNote(formData: FormData) {
  const user = await requireUser();
  const supabase = await createSupabaseServer();

  const noteId = String(formData.get("note_id") ?? "").trim();
  if (!noteId) {
    redirect(`/books?error=${enc("缺少 note_id")}`);
  }

  // Read new values
  const content = String(formData.get("content") ?? "").trim();
  const pageRefRaw = formData.get("page_ref");
  const quoteRaw = formData.get("quote");
  const pageRef = pageRefRaw ? String(pageRefRaw).trim() : "";
  const quote = quoteRaw ? String(quoteRaw).trim() : "";
  const sameBookOnly = formData.get("sameBookOnly") === "on";

  // Basic validation
  if (!content) {
    redirect(`/notes/${noteId}?error=${enc("请输入内容（content）")}`);
  }

  // Length guards
  if (content.length > CONTENT_MAX) {
    redirect(
      `/notes/${noteId}?error=${enc(
        `Content 过长：最多 ${CONTENT_MAX} 字，你现在是 ${content.length} 字。请缩短后再提交 🙂`
      )}`
    );
  }
  if (quote && quote.length > QUOTE_MAX) {
    redirect(
      `/notes/${noteId}?error=${enc(
        `Quote 过长：最多 ${QUOTE_MAX} 字，你现在是 ${quote.length} 字。请缩短后再提交 🙂`
      )}`
    );
  }
  if (pageRef && pageRef.length > PAGE_REF_MAX) {
    redirect(
      `/notes/${noteId}?error=${enc(
        `Page Ref 过长：最多 ${PAGE_REF_MAX} 字，你现在是 ${pageRef.length} 字。请缩短后再提交 🙂`
      )}`
    );
  }

  // Load current note to get book_id (needed for relink + safety)
  const { data: cur, error: curErr } = await supabase
    .from("notes")
    .select("id, book_id")
    .eq("id", noteId)
    .eq("user_id", user.id)
    .single();

  if (curErr || !cur?.id) {
    redirect(`/notes/${noteId}?error=${enc(curErr?.message || "找不到该笔记")}`);
  }

  const bookId = cur.book_id as string;

  // Update note
  const { error: upErr } = await supabase
    .from("notes")
    .update({
      content,
      page_ref: pageRef || null,
      quote: quote || null,
      same_book_only: sameBookOnly,
    })
    .eq("id", noteId)
    .eq("user_id", user.id);

  if (upErr) {
    redirect(`/notes/${noteId}?error=${enc(upErr.message || "更新失败")}`);
  }

  // Best-effort: embedding
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

      const { error: embErr } = await supabase
        .from("notes")
        .update({ embedding: embeddingStr })
        .eq("id", noteId)
        .eq("user_id", user.id);

      if (embErr) console.error("Embedding update failed:", embErr);
    }
  } catch (e: any) {
    console.error("Embedding generation failed:", e?.message || e);
  }

  // Best-effort: rebuild links (delete old semantic links -> rebuild)
  try {
    // 删除“这条 note 作为 from_note_id”产生的旧语义链接（避免开关变化后还残留旧结果）
    await supabase
      .from("note_links")
      .delete()
      .eq("user_id", user.id)
      .eq("from_note_id", noteId)
      .eq("link_type", "semantic");

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
    console.error("Auto relink failed:", e?.message || e);
  }

  // Back to note detail
  redirect(`/notes/${noteId}?success=${enc("Updated")}`);
}

/**
 * List notes by book (used by /books/[id] page)
 */
export async function listNotesByBook(bookId: string) {
  const user = await requireUser();
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from("notes")
    .select(
      "id, book_id, user_id, content, page_ref, quote, created_at, same_book_only"
    )
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
 * ✅ IMPORTANT: 不要 select 你数据库里没有的字段，否则会直接报错
 */
export async function getNote(noteId: string) {
  const user = await requireUser();
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from("notes")
    .select("id, user_id, book_id, content, page_ref, quote, created_at, same_book_only")
    .eq("user_id", user.id)
    .eq("id", noteId)
    .single();

  if (error) {
    return { ok: false as const, message: error.message };
  }
  return { ok: true as const, data };
}

export async function deleteNote(formData: FormData) {
  const user = await requireUser();
  const supabase = await createSupabaseServer();

  const noteId = String(formData.get("note_id") ?? "").trim();
  const bookId = String(formData.get("book_id") ?? "").trim();

  if (!noteId) {
    redirect(`/books/${bookId || ""}?error=${encodeURIComponent("Missing note_id")}`);
  }

  // 1) 先查出这条 note（确保是自己的，并拿到 book_id 用于 redirect）
  const { data: note, error: noteErr } = await supabase
    .from("notes")
    .select("id, book_id")
    .eq("id", noteId)
    .eq("user_id", user.id)
    .single();

  if (noteErr || !note) {
    redirect(`/books/${bookId || ""}?error=${encodeURIComponent(noteErr?.message || "Note not found")}`);
  }

  const realBookId = note.book_id as string;

  // 2) 清理 note_links（from / to 都要删）
  // 如果你没有 RLS 限制，这步应该会成功；有的话也不会影响主流程
  await supabase.from("note_links").delete().eq("user_id", user.id).eq("from_note_id", noteId);
  await supabase.from("note_links").delete().eq("user_id", user.id).eq("to_note_id", noteId);

  // 3) 先查 note_images 拿到 storage_key，用于删 storage 文件
  // （如果你之后想“只删 note 不删图片”，可以把 3/4 注释掉）
  const { data: imgs } = await supabase
    .from("note_images")
    .select("storage_key")
    .eq("note_id", noteId)
    .eq("user_id", user.id);

  const keys = (imgs ?? [])
    .map((x: any) => String(x.storage_key || "").trim())
    .filter(Boolean);

  // 4) 删除 note_images 表记录
  await supabase.from("note_images").delete().eq("note_id", noteId).eq("user_id", user.id);

  // 5) 删除 storage 里的文件（需要 service role）
  // 说明：你们的 bucket 是 private，且删除文件通常建议用 service role
  // 如果你现在已经有 SUPABASE_SERVICE_ROLE_KEY 在环境变量中，这段就能用
  try {
    if (keys.length > 0) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const { createClient } = await import("@supabase/supabase-js");

      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
      });

      // BUCKET 名字跟你之前 route.ts 一致
      const BUCKET = "note-images";
      await admin.storage.from(BUCKET).remove(keys);
    }
  } catch (e) {
    // 删 storage 失败也不影响删 note
    console.error("delete storage failed:", e);
  }

  // 6) 最后删除 notes 主记录
  const { error: delErr } = await supabase
    .from("notes")
    .delete()
    .eq("id", noteId)
    .eq("user_id", user.id);

  if (delErr) {
    redirect(`/notes/${noteId}?error=${encodeURIComponent(delErr.message)}`);
  }

  // 7) 返回书籍页
  redirect(`/books/${realBookId}?success=${encodeURIComponent("Deleted")}`);
}