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

  if (error) {
    return { ok: false as const, message: error.message, data: [] as any[] };
  }
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

  if (error) {
    return { ok: false as const, message: error.message, data: null as any };
  }
  return { ok: true as const, data };
}

/**
 * ✅ IMPORTANT:
 * This function is used by <form action={createBook}>.
 * So it MUST return void | Promise<void>.
 */
export async function createBook(formData: FormData): Promise<void> {
  const user = await requireUser();
  const supabase = await createSupabaseServer();

  const title = String(formData.get("title") || "").trim();
  const author = String(formData.get("author") || "").trim();
  const source = String(formData.get("source") || "").trim();

  if (!title) {
    redirect(`/books?error=${encodeURIComponent("Title is required.")}`);
  }

  // ✅ Daily Create Book limit (MUST be before insert)
  const usage = await bumpCreateBookUsageOrThrow({
    supabase,
    userId: user.id,
  });

  if (!usage.ok) {
    redirect(
      `/books?error=${encodeURIComponent(
        usage.message ||
          "You've reached today's limit (3). Please come back tomorrow 🙂"
      )}`
    );
  }

  const { error } = await supabase.from("books").insert({
    user_id: user.id,
    title,
    author: author || null,
    source: source || null,
  });

  if (error) {
    redirect(`/books?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/books?success=created");
}

/**
 * ✅ IMPORTANT:
 * This is also commonly used by <form action={deleteBook}>.
 * So it MUST return void | Promise<void>.
 */
export async function deleteBook(id: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createSupabaseServer();

  const { error } = await supabase
    .from("books")
    .delete()
    .eq("user_id", user.id)
    .eq("id", id);

  if (error) {
    redirect(`/books?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/books?success=deleted");
}