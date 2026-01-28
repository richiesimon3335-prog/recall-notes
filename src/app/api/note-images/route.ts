// src/app/api/note-images/route.ts
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BUCKET = "note-images";
const MAX_FILES = 3;
const MAX_BYTES_PER_FILE = 12 * 1024 * 1024; // 12MB（原图上限，防止极端 4K/8K 太离谱）

// full 图：给“拍书页/课件”用，建议别太小
const FULL_MAX_W = 2000;
const FULL_MAX_H = 2000;
const FULL_QUALITY = 72;

// thumb 图：列表预览用
const THUMB_W = 360;
const THUMB_QUALITY = 60;

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, message }, { status });
}

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function safeExtToWebpMime() {
  return "image/webp";
}

function makeObjectName() {
  // 简单唯一 ID
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function POST(req: NextRequest) {
  try {
    // 1) 必须登录（cookie session）
    const supabase = await createSupabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      return jsonError(401, "Not authenticated");
    }
    const user = userRes.user;

    // 2) 解析 multipart
    const form = await req.formData();
    const noteId = String(form.get("note_id") ?? "").trim();
    const files = form.getAll("files") as File[];

    if (!noteId) return jsonError(400, "Missing note_id");
    if (!files || files.length === 0) return jsonError(400, "No files uploaded");
    if (files.length > MAX_FILES) {
      return jsonError(400, `Too many files. Max ${MAX_FILES}.`);
    }

    // 3) Service role client（上传 storage + 插入 DB）
    const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 4) 逐个处理图片
    const insertedRows: any[] = [];

    for (const f of files) {
      if (!f.type.startsWith("image/")) {
        return jsonError(400, `Unsupported file type: ${f.type}`);
      }

      const arrayBuf = await f.arrayBuffer();
      const input = Buffer.from(arrayBuf);

      if (input.byteLength > MAX_BYTES_PER_FILE) {
        return jsonError(
          400,
          `File too large (> ${Math.round(
            MAX_BYTES_PER_FILE / 1024 / 1024
          )}MB): ${f.name}`
        );
      }

      // --- full ---
      const fullSharp = sharp(input)
        .rotate()
        .resize(FULL_MAX_W, FULL_MAX_H, {
          fit: "inside",
          withoutEnlargement: true,
        });

      const fullMeta = await fullSharp.metadata();
      const fullBuf = await fullSharp.webp({ quality: FULL_QUALITY }).toBuffer();

      // --- thumb ---
      const thumbSharp = sharp(input)
        .rotate()
        .resize(THUMB_W, THUMB_W, {
          fit: "inside",
          withoutEnlargement: true,
        });

      const thumbMeta = await thumbSharp.metadata();
      const thumbBuf = await thumbSharp.webp({ quality: THUMB_QUALITY }).toBuffer();

      const base = makeObjectName();
      const fullPath = `${user.id}/${noteId}/${base}.webp`;
      const thumbPath = `${user.id}/${noteId}/${base}_thumb.webp`;

      // 5) 上传到 storage（private bucket）
      const up1 = await admin.storage.from(BUCKET).upload(fullPath, fullBuf, {
        contentType: safeExtToWebpMime(),
        upsert: false,
      });
      if (up1.error) {
        return jsonError(500, `Upload full failed: ${up1.error.message}`);
      }

      const up2 = await admin.storage.from(BUCKET).upload(thumbPath, thumbBuf, {
        contentType: safeExtToWebpMime(),
        upsert: false,
      });
      if (up2.error) {
        return jsonError(500, `Upload thumb failed: ${up2.error.message}`);
      }

      // 6) 写入 note_images 表：按 kind 存两行（full + thumb）
      const rowsToInsert = [
        {
          user_id: user.id,
          note_id: noteId,
          kind: "full",
          storage_key: fullPath,
          width: fullMeta.width ?? null,
          height: fullMeta.height ?? null,
          bytes: fullBuf.byteLength,
          mime: "image/webp",
        },
        {
          user_id: user.id,
          note_id: noteId,
          kind: "thumb",
          storage_key: thumbPath,
          width: thumbMeta.width ?? null,
          height: thumbMeta.height ?? null,
          bytes: thumbBuf.byteLength,
          mime: "image/webp",
        },
      ];

      const { data: inserted, error: insErr } = await admin
        .from("note_images")
        .insert(rowsToInsert)
        .select("*");

      if (insErr) {
        return jsonError(500, `DB insert failed: ${insErr.message}`);
      }

      if (Array.isArray(inserted)) {
        insertedRows.push(...inserted);
      }
    }

    // ✅ 注意：return 一定要在 for 循环结束后（否则只处理第一张图）
    return NextResponse.json({ ok: true, images: insertedRows });
  } catch (e: any) {
    console.error(e);
    return jsonError(500, e?.message || "Unknown error");
  }
}