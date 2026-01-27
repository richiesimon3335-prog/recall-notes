"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { bumpCreateBookUsageOrThrow } from "@/app/actions/usage/bumpCreateBookUsageOrThrow";

export async function listBooks() {
  const user = await requireUser();
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from("books")
    .select("id, title, author, source, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { ok: false as const, message: error.message, data: [] as any[] };
  return { ok: true as const, data };
}

export async function getBook(id: string) {
  const user = await requireUser();
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from("books")
    .select("id, title, author, source, created_at")
    .eq("user_id", user.id)
    .eq("id", id)
    .single();

  if (error) return { ok: false as const, message: error.message, data: null as any };
  return { ok: true as const, data };
}

export async function createBook(formData: FormData) {
  const user = await requireUser();
  const supabase = await createSupabaseServer();

  const title = String(formData.get("title") || "").trim();
  const author = String(formData.get("author") || "").trim();
  const source = String(formData.get("source") || "").trim();

  if (!title) return { ok: false as const, message: "Title 不能为空" };

// ✅ Daily Create Book limit (MUST be before insert)
const usage = await bumpCreateBookUsageOrThrow({
  supabase,
  userId: user.id,
});

if (!usage.ok) {
  // 用 redirect 才能让 UI 通过 URL 展示提示（和 Note 一样）
  redirect(
    `/books?error=${encodeURIComponent(
      usage.message || "今日新增书籍次数已达上限（3 本），请明天再来 🙂"
    )}`
  );
}

  const { error } = await supabase.from("books").insert({
    user_id: user.id,
    title,
    author: author || null,
    source: source || null,
  });

  if (error) return { ok: false as const, message: error.message };

  redirect("/books");
}

export async function deleteBook(id: string) {
  const user = await requireUser();
  const supabase = await createSupabaseServer();

  const { error } = await supabase
    .from("books")
    .delete()
    .eq("user_id", user.id)
    .eq("id", id);

  if (error) return { ok: false as const, message: error.message };

  redirect("/books");
}