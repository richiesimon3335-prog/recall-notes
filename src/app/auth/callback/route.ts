// src/app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

function getCanonicalOrigin(requestUrl: URL) {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  // 兜底：用当前请求 origin
  return requestUrl.origin;
}

function safeNextPath(next: string | null) {
  // 只允许站内相对路径，避免 open redirect
  if (!next) return "/books";
  if (!next.startsWith("/")) return "/books";
  return next;
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  // Supabase 有时会带 error 参数回来
  const errDesc =
    url.searchParams.get("error_description") ||
    url.searchParams.get("error") ||
    null;

  const origin = getCanonicalOrigin(url);

  // 1) 如果 supabase 已经告诉你有错，直接回登录页显示错误
  if (errDesc) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errDesc)}`, origin)
    );
  }

  // 2) 没有 code 就回登录页
  if (!code) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent("Missing code.")}`, origin)
    );
  }

  // 3) 用 code 换 session（写 cookie）
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, origin)
    );
  }

  // 4) 成功后跳转到 next（例如 /reset-password）
  return NextResponse.redirect(new URL(next, origin));
}