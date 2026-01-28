// src/app/actions/noteImages.ts
"use server";

import { requireUser } from "@/app/actions/auth";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "note-images";
const SIGNED_URL_EXPIRES = 60 * 60; // 1 hour

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function listNoteImages(noteId: string) {
  const user = await requireUser();

  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // 只取当前用户自己的图片
  const { data, error } = await admin
    .from("note_images")
    .select("id, note_id, user_id, kind, storage_key, width, height, bytes, mime, created_at")
    .eq("note_id", noteId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return { ok: false as const, message: error.message, images: [] as any[] };
  }

  const images = (data ?? []) as any[];

  // 给每一行生成 signed url（private bucket 必须这样）
  const withUrls = [];
  for (const row of images) {
    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(row.storage_key, SIGNED_URL_EXPIRES);

    if (signErr || !signed?.signedUrl) {
      // 不要让整个页面挂掉，跳过这张
      continue;
    }

    withUrls.push({
      ...row,
      url: signed.signedUrl,
    });
  }

  return { ok: true as const, images: withUrls };
}