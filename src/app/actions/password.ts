// src/app/actions/password.ts
"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

function enc(msg: string) {
  return encodeURIComponent(msg);
}

/**
 * ✅ 稳定拿到站点根地址
 * - 线上（Vercel）：NEXT_PUBLIC_SITE_URL=https://www.recallnotes.ca
 * - 本地：NEXT_PUBLIC_SITE_URL=http://localhost:3000
 *
 * 这里不再用 headers()，避免 Vercel/Next 的类型差异导致 build fail
 */
function getBaseUrl() {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");
  return "http://localhost:3000";
}

/**
 * 发送重置密码邮件
 * 会跳转回 /auth/forgot?success=xxx 或 ?error=xxx
 */
export async function sendPasswordResetEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect(`/auth/forgot?error=${enc("Please enter your email.")}`);
  }

  const supabase = await createSupabaseServer();

  // ✅ 用户点邮件链接后 -> /auth/callback -> 再跳到 /auth/reset
  const redirectTo = `${getBaseUrl()}/auth/callback?next=/auth/reset`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    redirect(`/auth/forgot?error=${enc(error.message)}`);
  }

  redirect(
    `/auth/forgot?success=${enc(
      "Email sent. Please check your inbox (and spam folder)."
    )}`
  );
}

/**
 * 更新密码（用户必须已处于 recovery session / 登录态）
 */
export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!password || password.length < 8) {
    redirect(
      `/auth/reset?error=${enc("Password must be at least 8 characters.")}`
    );
  }

  if (password !== confirm) {
    redirect(`/auth/reset?error=${enc("Passwords do not match.")}`);
  }

  const supabase = await createSupabaseServer();

  // ✅ 确认当前有 user（说明 recovery session 还有效）
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    redirect(
      `/auth/forgot?error=${enc(
        "Your reset link is invalid or expired. Please request a new one."
      )}`
    );
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/auth/reset?error=${enc(error.message)}`);
  }

  // ✅ 成功后留在 reset 页面显示 success
  redirect(`/auth/reset?success=${enc("Password updated successfully.")}`);
}