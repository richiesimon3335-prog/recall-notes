// src/app/auth/reset/page.tsx
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { updatePassword } from "@/app/actions/password";

type SearchParams = Record<string, string | string[] | undefined>;

function toSingleString(v: string | string[] | undefined) {
  if (!v) return "";
  return Array.isArray(v) ? v[0] ?? "" : v;
}

export default async function ResetPasswordPage(props: { searchParams?: SearchParams }) {
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

      <h1 className="text-xl font-semibold">Reset password</h1>

      {errorMsg && <ErrorBanner message={errorMsg} />}
      {successMsg ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {successMsg}
        </div>
      ) : null}

      <Card>
        <form className="space-y-3" action={updatePassword}>
          <div>
            <label className="text-sm text-zinc-900">New password</label>
            <Input name="password" type="password" required placeholder="At least 8 characters" />
          </div>

          <div>
            <label className="text-sm text-zinc-900">Confirm password</label>
            <Input name="confirm" type="password" required placeholder="Repeat the password" />
          </div>

          <Button type="submit">Update password</Button>
        </form>
      </Card>
    </div>
  );
}