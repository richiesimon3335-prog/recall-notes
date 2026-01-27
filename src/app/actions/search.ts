// src/app/actions/search.ts
"use server";

import { createEmbedding } from "@/lib/openai";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/app/actions/auth";
import { bumpAskUsageOrThrow } from "@/app/actions/usage/bumpAskUsageOrThrow";

const ASK_DAILY_LIMIT = 20;

function todayUTCDateString() {
  // 用 UTC 的日期，避免服务器时区导致“今天”错乱
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`; // e.g. 2026-01-25
}

/**
 * 每日 Ask 次数 +1，并在超过上限时拦截（不会产生 embedding 成本）
 * - 使用 user_daily_usage 表
 * - 先 upsert 确保有行
 * - 再原子更新 ask_count = ask_count + 1，并返回更新后的值
 */

export async function semanticSearchNotes(q: string) {
  const user = await requireUser();
  const supabase = await createSupabaseServer();

  const query = (q ?? "").trim();
  if (!query) return { ok: true as const, results: [] as any[] };

  // ✅ Step 2：先做每日 Ask 限制（在 embedding 之前）
  const usage = await bumpAskUsageOrThrow({ supabase, userId: user.id });
  if (!usage.ok) {
    return {
      ok: false as const,
      message: usage.message,
      results: [] as any[],
      usage: {
        limit: usage.limit,
        used: usage.used,
        remaining: usage.remaining,
      },
    };
  }

  // 1) embed query（只有没超限才会走到这里 -> 才会产生 OpenAI 成本）
  const embedding = await createEmbedding(query);
  const queryEmbedding = `[${embedding.join(",")}]`;

  // 2) RPC match（already filtered by user_id in SQL）
  const { data, error } = await supabase.rpc("match_notes", {
    p_user_id: user.id,
    query_embedding: queryEmbedding,
    match_count: 10,
    match_threshold: 0.2,
  });

  if (error) {
    return {
      ok: false as const,
      message: error.message,
      results: [] as any[],
      usage: {
        limit: usage.limit,
        used: usage.used,
        remaining: usage.remaining,
      },
    };
  }

  // 3) return directly (already contains similarity)
  return {
    ok: true as const,
    results: data ?? [],
    usage: {
      limit: usage.limit,
      used: usage.used,
      remaining: usage.remaining,
    },
  };
}