// src/app/actions/password.ts
"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";

function enc(msg: string) {
  return encodeURIComponent(msg);
}

/**
 * 尽量可靠地拿到当前站点根地址（本地/线上都可用）
 * 优先级：
 * 1) NEXT_PUBLIC_SITE_URL
 * 2) origin
 * 3) x-forwarded-host/host + x-forwarded-proto
 * 4) http://localhost:3000（最后兜底）
 */
function getBaseUrl() {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");

  const h = headers();

  const origin = h.get("origin");
  if (origin) return origin.replace(/\/$/, "");

  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`.replace(/\/$/, "");

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
  const baseUrl = getBaseUrl();
  const redirectTo = `${baseUrl}/auth/callback?next=/auth/reset`;

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
    redirect(`/auth/reset?error=${enc("Password must be at least 8 characters.")}`);
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
  //（如果你更希望跳 /books 或 /login，也可以改这里）
  redirect(`/auth/reset?success=${enc("Password updated successfully.")}`);
}