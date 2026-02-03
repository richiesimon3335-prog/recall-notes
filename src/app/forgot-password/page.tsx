// src/app/forgot-password/page.tsx
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { sendPasswordResetEmail } from "@/app/actions/auth";

type SP = { error?: string; success?: string };

export default async function ForgotPasswordPage(props: {
  searchParams?: SP | Promise<SP>;
}) {
  const sp = (await props.searchParams) ?? {};
  const error = sp.error ?? null;
  const success = sp.success ?? null;

  return (
    <div className="mx-auto max-w-md space-y-3">
      <Card>
        <h1 className="text-lg font-semibold text-zinc-600">Forgot password</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Enter your email and we’ll send you a reset link.
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

        <form className="mt-4 space-y-3" action={sendPasswordResetEmail}>
          <div>
            <label className="text-sm text-zinc-600">Email</label>
            <Input name="email" type="email" placeholder="you@example.com" required />
          </div>

          <Button type="submit" className="w-full">
            Send reset link
          </Button>

          <div className="text-center text-sm">
            <Link href="/login" className="text-zinc-500 hover:underline">
              Back to login
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}