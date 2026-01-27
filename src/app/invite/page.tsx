import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { redirect } from "next/navigation";
import { validateInviteCode } from "@/app/actions/invite";

type SearchParams = Record<string, string | string[] | undefined>;
function toSingleString(v: string | string[] | undefined) {
  if (!v) return "";
  return Array.isArray(v) ? v[0] ?? "" : v;
}

export default async function InvitePage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const errorMsg = toSingleString(searchParams?.error).trim();

  async function submit(formData: FormData) {
    "use server";
    const code = String(formData.get("code") ?? "");

    const res = await validateInviteCode(code);
    if (!res.ok) {
      redirect(`/invite?error=${encodeURIComponent(res.message)}`);
    }
    // ✅ 通过就把邀请码带去 login
    redirect(`/login?invite=${encodeURIComponent(res.code)}`);
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Invite</h1>
        <p className="mt-2 text-sm text-zinc-600">
          An invite code is required to sign up. We use it to control access during our early testing phase 🙂
        </p>
      </div>

      {errorMsg && <ErrorBanner message={errorMsg} />}

      <Card className="p-4">
        <form action={submit} className="space-y-3">
          <Input name="code" placeholder="例如：AB9K-3FQ2" required />
          <Button type="submit">Continue</Button>
        </form>
      </Card>
    </div>
  );
}