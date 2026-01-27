"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { validateInviteCode, normalizeInviteCode } from "@/app/actions/invite";

function enc(msg: string) {
  return encodeURIComponent(msg);
}

function loginUrl(params: Record<string, string | undefined>) {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join("&");
  return qs ? `/login?${qs}` : "/login";
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
    redirect(loginUrl({ error: "Please enter email and password." }));
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // 这里显示 Supabase 返回的信息，例如 Invalid login credentials
    redirect(loginUrl({ error: error.message }));
  }

  redirect("/books");
}

/**
 * Sign up with email + password + invite code
 * - success (email confirmation OFF): redirect to /books
 * - success (email confirmation ON):  redirect back to /login?success=...
 * - error:                            redirect back to /login?error=... (&invite=...)
 *
 * ✅ 关键：注册流程不再跳 /invite 页面，避免二次输入邀请码
 */
export async function signUpWithEmail(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const inviteRaw = String(formData.get("invite") ?? "").trim();

  if (!email || !password) {
    redirect(loginUrl({ error: "Please enter email and password." }));
  }

  // ✅ 邀请码必须存在：直接回 /login，不要跳 /invite
  if (!inviteRaw) {
    redirect(loginUrl({ error: "An invite code is required to sign up." }));
  }

  // ✅ 校验邀请码：失败也回 /login，并把 invite 带回去（避免用户重新输入）
  const v = await validateInviteCode(inviteRaw);
  if (!v.ok) {
    redirect(loginUrl({ error: v.message, invite: inviteRaw }));
  }

  const supabase = await createSupabaseServer();

  // ✅ 注册
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    redirect(loginUrl({ error: error.message, invite: inviteRaw }));
  }

  // ✅ 注册成功后：消耗邀请码（一次性）
  const code = normalizeInviteCode(inviteRaw);
  const { error: consumeErr } = await supabase.rpc("consume_invite_code", {
    p_code: code,
  });

  // 建议：消耗失败只记日志，不影响用户注册体验
  if (consumeErr) {
    console.error("consume_invite_code failed:", consumeErr);
  }

  // ✅ Supabase 开了邮箱验证时，data.session 会是 null
  if (!data?.session) {
    redirect(
      loginUrl({
        success:
          "Sign up successful! Please check your email (including Spam) to confirm your account, then sign in.",
      })
    );
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