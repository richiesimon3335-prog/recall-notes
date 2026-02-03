"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createSupabaseServer } from "@/lib/supabase/server";
import { validateInviteCode, normalizeInviteCode } from "@/app/actions/invite";

/** encodeURIComponent 的短别名 */
function enc(msg: string) {
  return encodeURIComponent(msg);
}

/** 生成 /login?error=...&invite=... 这种 URL */
function loginUrl(params: Record<string, string | undefined>) {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join("&");
  return qs ? `/login?${qs}` : "/login";
}

/**
 * ✅ 尽量可靠地拿到当前站点根地址（本地/线上都可用）
 * 优先级：
 * 1) NEXT_PUBLIC_SITE_URL（你本地 .env.local = http://localhost:3000；Vercel = https://www.recallnotes.ca）
 * 2) 请求头 origin（有些场景可用）
 * 3) 请求头 host + proto（兜底）
 * 4) 最终兜底 http://localhost:3000
 *
 * ⚠️ 关键修复：Next 16.1.4 的 headers() 在类型里可能是 Promise，需要 await
 */
async function getBaseUrl() {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");

  try {
    const h = await headers();

    const origin = h.get("origin");
    if (origin) return origin.replace(/\/$/, "");

    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "http";
    if (host) return `${proto}://${host}`.replace(/\/$/, "");
  } catch {
    // headers() 在少数环境/调用时机可能不可用：直接走兜底
  }

  return "http://localhost:3000";
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
    redirect(loginUrl({ error: error.message }));
  }

  redirect("/books");
}

/**
 * Sign up with email + password + invite code
 * ✅ 注册流程不再跳 /invite 页面，避免二次输入邀请码
 */
export async function signUpWithEmail(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const inviteRaw = String(formData.get("invite") ?? "").trim();

  if (!email || !password) {
    redirect(loginUrl({ error: "Please enter email and password." }));
  }

  if (!inviteRaw) {
    redirect(loginUrl({ error: "An invite code is required to sign up." }));
  }

  const v = await validateInviteCode(inviteRaw);
  if (!v.ok) {
    redirect(loginUrl({ error: v.message, invite: inviteRaw }));
  }

  const supabase = await createSupabaseServer();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    redirect(loginUrl({ error: error.message, invite: inviteRaw }));
  }

  // ✅ 注册成功后消耗邀请码（一次性）
  const code = normalizeInviteCode(inviteRaw);
  const { error: consumeErr } = await supabase.rpc("consume_invite_code", {
    p_code: code,
  });

  // 消耗失败不阻断注册
  if (consumeErr) {
    console.error("consume_invite_code failed:", consumeErr);
  }

  // ✅ 开启邮箱验证时 data.session 为空
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

/**
 * Send password reset email
 * - success: redirect back to /forgot-password?success=...
 * - error:   redirect back to /forgot-password?error=...
 */
export async function sendPasswordResetEmail(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  if (!email) {
    redirect(`/forgot-password?error=${enc("Please enter your email.")}`);
  }

  const supabase = await createSupabaseServer();

  // 用户点邮件链接后 -> /auth/callback -> 再跳到 /reset-password
  const baseUrl = await getBaseUrl();
  const redirectTo = `${baseUrl}/auth/callback?next=/reset-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    redirect(`/forgot-password?error=${enc(error.message)}`);
  }

  redirect(
    `/forgot-password?success=${enc(
      "If this email exists, we’ve sent a password reset link. Please check your inbox (and spam)."
    )}`
  );
}

/**
 * Update password (user must already have a valid recovery session)
 * - success: redirect to /books?success=...
 * - error:   redirect back to /reset-password?error=...
 */
export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");

  if (!password || password.length < 6) {
    redirect(`/reset-password?error=${enc("Password must be at least 6 characters.")}`);
  }

  if (password !== confirm) {
    redirect(`/reset-password?error=${enc("Passwords do not match.")}`);
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/reset-password?error=${enc(error.message)}`);
  }

  redirect(`/books?success=${enc("Password updated successfully.")}`);
}