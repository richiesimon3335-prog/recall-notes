const DAILY_BOOK_LIMIT = 3;

export async function bumpCreateBookUsageOrThrow({
  supabase,
  userId,
}: {
  supabase: any;
  userId: string;
}) {
  const { data, error } = await supabase.rpc(
    "bump_daily_book_usage",
    {
      p_user_id: userId,
      p_limit: DAILY_BOOK_LIMIT,
    }
  );

  if (error) {
    if (error.message?.includes("BOOK_DAILY_LIMIT_REACHED")) {
      return {
        ok: false,
        message: `今日新增书籍次数已达上限（${DAILY_BOOK_LIMIT} 本），请明天再来 🙂`,
        limit: DAILY_BOOK_LIMIT,
        used: DAILY_BOOK_LIMIT,
        remaining: 0,
      };
    }

    return {
      ok: false,
      message: "Create book usage check failed",
    };
  }

  const row = data?.[0];
  return {
    ok: true,
    limit: row.limit_value,
    used: row.used,
    remaining: row.remaining,
  };
}