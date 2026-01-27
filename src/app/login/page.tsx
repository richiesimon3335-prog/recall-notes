// src/app/login/page.tsx
import { Card } from "@/components/ui/Card";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { signInWithEmail, signUpWithEmail } from "@/app/actions/auth";

type SP = {
  error?: string;
  invite?: string; // ✅ 从 URL 读邀请码：/login?invite=XXXX
};

export default async function LoginPage(props: {
  searchParams?: SP | Promise<SP>;
}) {
  const sp = (await props.searchParams) ?? {};
  const error = sp.error ?? null;

  // ✅ 如果 URL 带了 invite，就预填到邀请码输入框里
  const inviteFromUrl = (sp.invite ?? "").toString();

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-lg font-semibold text-zinc-600">Login / Register</h1>
        <p className="mt-1 text-sm text-zinc-600">Use email + password.</p>

        <div className="mt-3">
          <ErrorBanner message={error} />
        </div>

        {/* 一个表单，两个按钮，分别触发不同 action */}
        <form className="mt-4 space-y-3">
          {/* ✅ 关键：确保 invite 一定会跟着表单提交（即使用户不手动输入） */}
          <input type="hidden" name="invite" value={inviteFromUrl} />

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

          {/* ✅ 邀请码（可选但推荐） */}
          <div>
            <label className="text-sm text-zinc-600">Invite Code</label>
            <Input
              name="invite"
              placeholder="RBK-CB8FB2XXXX"
              defaultValue={inviteFromUrl}
            />
            <p className="mt-1 text-xs text-zinc-500">
              Only required for sign up. Not needed for sign in.</p>
          </div>

          <div className="space-y-2 pt-1">
            {/* 注意：用 formAction 指定 action */}
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
          </div>
        </form>

      
      </Card>
    </div>
  );
}