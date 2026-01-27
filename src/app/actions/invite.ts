import { createSupabaseServer } from "@/lib/supabase/server";

// 统一规范：邀请码大小写不敏感、去空格
export function normalizeInviteCode(code: string) {
  return code.trim().toUpperCase();
}

/**
 * 校验邀请码是否可用（不消耗）
 */
export async function validateInviteCode(codeRaw: string) {
  const supabase = await createSupabaseServer();
  const code = normalizeInviteCode(codeRaw);

  if (!code) return { ok: false as const, message: "请输入邀请码" };

  const { data, error } = await supabase
    .from("invite_codes")
    .select("code, max_uses, used_count, is_active, expires_at")
    .eq("code", code)
    .single();

  if (error || !data) return { ok: false as const, message: "邀请码无效" };
  if (!data.is_active) return { ok: false as const, message: "邀请码已停用" };
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false as const, message: "邀请码已过期" };
  }
  if (data.used_count >= data.max_uses) {
    return { ok: false as const, message: "邀请码已被使用" };
  }

  return { ok: true as const, code };
}