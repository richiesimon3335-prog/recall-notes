// src/app/actions/usage/bumpAskUsageOrThrow.ts
"use server";

const DAILY_ASK_LIMIT = 20;

export async function bumpAskUsageOrThrow({
  supabase,
  userId,
}: {
  supabase: any;
  userId: string;
}): Promise<
  | {
      ok: true;
      limit: number;
      used: number;
      remaining: number;
    }
  | {
      ok: false;
      message: string;
      limit: number;
      used: number;
      remaining: number;
    }
> {
  // ✅ 关键：直接调用你已经在 Supabase 里创建成功的 RPC：public.bump_daily_ask_usage
  // 这个 RPC 内部会“原子 +1 + 超限报错”，最稳、也最省事。
  const { data, error } = await supabase.rpc("bump_daily_ask_usage", {
    p_user_id: userId,
    p_limit: DAILY_ASK_LIMIT,
  });

  // RPC 成功：data 通常是 { used, limit_value, remaining } 这样的对象（或数组里第一个对象）
  if (!error) {
    const row = Array.isArray(data) ? data[0] : data;
    const used = Number(row?.used ?? 0);
    const remaining = Number(row?.remaining ?? Math.max(DAILY_ASK_LIMIT - used, 0));
    return {
      ok: true,
      limit: DAILY_ASK_LIMIT,
      used,
      remaining,
    };
  }

  // RPC 超限：你 SQL 里 raise exception 'ASK_DAILY_LIMIT_REACHED'
  // Supabase 会把它带到 error.message 里
  const msg = String(error.message || "");
  if (msg.includes("ASK_DAILY_LIMIT_REACHED")) {
    // 超限时我们也尽量给 used/remaining
    // 由于抛异常后可能拿不到 used，这里保底返回 used=DAILY_ASK_LIMIT, remaining=0
    return {
      ok: false,
      message: `今日 Ask 次数已达上限（${DAILY_ASK_LIMIT} 次）。请明天再来 🙂`,
      limit: DAILY_ASK_LIMIT,
      used: DAILY_ASK_LIMIT,
      remaining: 0,
    };
  }

  // 其他错误：把原始信息带出来，方便你排查
  return {
    ok: false,
    message: `Ask usage check failed: ${msg}`,
    limit: DAILY_ASK_LIMIT,
    used: 0,
    remaining: DAILY_ASK_LIMIT,
  };
}