"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { validateInviteCode, normalizeInviteCode } from "@/app/actions/invite";

function enc(msg: string) {
  return encodeURIComponent(msg);
}

/**
 * Sign in with email + password
 * - success: redirect to /books
 * - error:   redirect back to /login?error=...
 */
export async function signInWithEmail(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    redirect(`/login?error=${enc("请输入 email 和 password")}`);
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${enc(error.message)}`);
  }

  redirect("/books");
}

/**
 * Sign up with email + password
 * - success (email confirmation OFF): redirect to /books
 * - success (email confirmation ON):  redirect back to /login with a friendly message
 * - error:                            redirect back to /login?error=...
 */
export async function signUpWithEmail(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  // ✅ 1) 先取邀请码
  const invite = String(formData.get("invite") ?? "").trim();

  if (!email || !password) {
    redirect(`/login?error=${enc("请输入 email 和 password")}`);
  }

  // ✅ 2) 必须有邀请码（没有就不让注册）
  if (!invite) {
    redirect(`/invite?error=${enc("需要邀请码才能注册")}`);
  }

  // ✅ 3) 先校验邀请码（不通过就直接提示）
  const v = await validateInviteCode(invite);
  if (!v.ok) {
    redirect(`/invite?error=${enc(v.message)}`);
  }

  const supabase = await createSupabaseServer();

  // ✅ 4) 再注册（只注册一次！）
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${enc(error.message)}`);
  }

  // ✅ 5) 注册成功后：原子消耗邀请码（RPC）
  const code = normalizeInviteCode(invite);
  const { error: consumeErr } = await supabase.rpc("consume_invite_code", {
    p_code: code,
  });

  // 这里建议：失败就记日志，不要让用户注册失败（体验更好）
  if (consumeErr) {
    console.error("consume_invite_code failed:", consumeErr);
  }

  // ✅ 6) 你原来的后续逻辑（你截图里写了 email confirmation 的说明）
  // 如果你项目里 email confirmation ON，就跳回 /login 让他去邮箱确认
  // 否则可以直接去 /books
  // 你原本怎么写就怎么写，这里我不乱改你项目逻辑：
  // （保守做法：按你原来的注释继续执行）
  if (!data?.session) {
    redirect(`/login?success=${enc("注册成功！请去邮箱完成验证后再登录 🙂")}`);
  }

  redirect("/books");
}

/**
 * Sign out then go back to /login
 */
export async function signOut() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Require a logged-in user, otherwise redirect to /login
 */
export async function requireUser() {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/login");
  }

  return data.user;
}