// src/app/auth/forgot/page.tsx
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { sendPasswordResetEmail } from "@/app/actions/password";

type SearchParams = Record<string, string | string[] | undefined>;

function toSingleString(v: string | string[] | undefined) {
  if (!v) return "";
  return Array.isArray(v) ? v[0] ?? "" : v;
}

export default async function ForgotPasswordPage(props: { searchParams?: SearchParams }) {
  const sp = props.searchParams ?? {};
  const errorMsg = toSingleString(sp.error).trim();
  const successMsg = toSingleString(sp.success).trim();

  return (
    <div className="space-y-4">
      <div className="text-sm text-zinc-500">
        <Link href="/login" className="hover:underline">
          ← Back to login
        </Link>
      </div>

      <h1 className="text-xl font-semibold">Forgot password</h1>

      {errorMsg && <ErrorBanner message={errorMsg} />}
      {successMsg ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {successMsg}
        </div>
      ) : null}

      <Card>
        <p className="text-sm text-zinc-600">
          Enter your email and we’ll send you a reset link.
        </p>

        <form className="mt-3 space-y-3" action={sendPasswordResetEmail}>
          <div>
            <label className="text-sm text-zinc-900">Email</label>
            <Input name="email" type="email" required placeholder="you@example.com" />
          </div>

          <Button type="submit">Send reset link</Button>
        </form>
      </Card>
    </div>
  );
}