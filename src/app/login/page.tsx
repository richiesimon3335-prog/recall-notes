// src/app/login/page.tsx
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { signInWithEmail, signUpWithEmail } from "@/app/actions/auth";

type SP = {
  error?: string;
  success?: string; // ✅ 注册成功提示
  invite?: string;  // 从 URL 读邀请码：/login?invite=XXXX
};

export default async function LoginPage(props: {
  searchParams?: SP | Promise<SP>;
}) {
  const sp = (await props.searchParams) ?? {};
  const error = sp.error ?? null;
  const success = sp.success ?? null;

  // 如果 URL 里带 invite，就预填
  const inviteFromUrl = (sp.invite ?? "").toString();

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-lg font-semibold text-zinc-600">
          Login / Register
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Use email + password.
        </p>

        {(success || error) && (
          <div className="mt-3 space-y-2">
            {success && (
              <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                {success}
              </div>
            )}
            {error && <ErrorBanner message={error} />}
          </div>
        )}

        <form className="mt-4 space-y-3">
          <div>
            <label className="text-sm text-zinc-600">Email</label>
            <Input
              name="email"
              type="email"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="text-sm text-zinc-600">Password</label>
            <Input
              name="password"
              type="password"
              placeholder="••••••••"
              required
            />
          </div>

          <div>
            <label className="text-sm text-zinc-600">Invite Code</label>
            <Input
              name="invite"
              placeholder="RBK-CB8FB2XXXX"
              defaultValue={inviteFromUrl}
            />
            <p className="mt-1 text-xs text-red-500">
              Only required for sign up. Not needed for sign in.
            </p>
          </div>

          <div className="space-y-2 pt-1">
            <Button
              type="submit"
              className="w-full"
              formAction={signInWithEmail}
            >
              Sign In
            </Button>

            <Button
              type="submit"
              className="w-full bg-zinc-900"
              formAction={signUpWithEmail}
            >
              Sign Up
            </Button>

            {/* ✅ 忘记密码入口（放在按钮下面最符合用户视线） */}
            <div className="pt-2 text-center text-sm">
              <Link
                href="/forgot-password"
                className="text-zinc-500 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}