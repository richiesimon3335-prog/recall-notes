import { PostgrestError } from "@supabase/supabase-js";

const DAILY_CREATE_NOTE_LIMIT = 15;

export async function bumpCreateNoteUsageOrThrow({
  supabase,
  userId,
}: {
  supabase: any;
  userId: string;
}) {
  const { data, error } = await supabase.rpc("bump_daily_create_note_usage", {
    p_user_id: userId,
    p_limit: DAILY_CREATE_NOTE_LIMIT,
  });

  // ✅ 超限：我们用 RPC 的异常字符串识别
  if (error) {
    const msg = (error as PostgrestError)?.message || "";

    if (msg.includes("CREATE_NOTE_DAILY_LIMIT_REACHED")) {
      return {
        ok: false as const,
        message: `今日新增笔记次数已达上限（${DAILY_CREATE_NOTE_LIMIT} 条）。请明天再来 🙂`,
        limit: DAILY_CREATE_NOTE_LIMIT,
        used: DAILY_CREATE_NOTE_LIMIT,
        remaining: 0,
      };
    }

    return {
      ok: false as const,
      message: `Create Note usage error: ${msg}`,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok: true as const,
    limit: row?.limit_value ?? DAILY_CREATE_NOTE_LIMIT,
    used: row?.used ?? 0,
    remaining: row?.remaining ?? 0,
  };
}