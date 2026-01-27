import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { requireUser } from "@/app/actions/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import crypto from "crypto";

type SearchParams = Record<string, string | string[] | undefined>;

function toSingleString(v: string | string[] | undefined) {
  if (!v) return "";
  return Array.isArray(v) ? v[0] ?? "" : v;
}

function makeInviteCode(prefix = "RBK") {
  // 10位大写字母数字
  const s = crypto.randomBytes(6).toString("hex").slice(0, 10).toUpperCase();
  return `${prefix}-${s}`;
}

async function getAuthedEmail() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? null;
}

function isAdminEmail(email: string | null) {
  // ✅ 你可以在 .env 里配：ADMIN_EMAILS=a@a.com,b@b.com
  const allow = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (!email) return false;
  if (allow.length === 0) return false; // 没配置就默认不放行，最安全
  return allow.includes(email.toLowerCase());
}

export default async function AdminInvitesPage(props: { searchParams?: SearchParams }) {
  await requireUser(); // 先保证登录

  const email = await getAuthedEmail();
  if (!isAdminEmail(email)) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorBanner message="你没有管理员权限（ADMIN ONLY）。" />
        <div className="mt-2 text-sm text-zinc-600">
          请在环境变量里配置 <span className="font-mono">ADMIN_EMAILS</span>，例如：
          <span className="ml-2 font-mono">ADMIN_EMAILS=you@example.com</span>
        </div>
      </div>
    );
  }

  const sp = props.searchParams ?? {};
  const errorMsg = toSingleString(sp.error).trim();
  const successMsg = toSingleString(sp.success).trim();

  const supabase = await createSupabaseServer();

  // 最近 100 个邀请码
  const { data: codes } = await supabase
    .from("invite_codes")
    .select("code, max_uses, used_count, is_active, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  async function generateAction(formData: FormData) {
    "use server";

    await requireUser();
    const email = await getAuthedEmail();
    if (!isAdminEmail(email)) {
      redirect(`/admin/invites?error=${encodeURIComponent("无管理员权限")}`);
    }

    const supabase = await createSupabaseServer();

    const countRaw = String(formData.get("count") ?? "20").trim();
    const maxUsesRaw = String(formData.get("max_uses") ?? "1").trim();
    const prefix = String(formData.get("prefix") ?? "RBK").trim().toUpperCase() || "RBK";

    const count = Math.min(Math.max(parseInt(countRaw, 10) || 20, 1), 500); // 1~500
    const maxUses = Math.min(Math.max(parseInt(maxUsesRaw, 10) || 1, 1), 50); // 1~50

    // 生成 codes
    const rows = Array.from({ length: count }).map(() => ({
      code: makeInviteCode(prefix),
      max_uses: maxUses,
      used_count: 0,
      is_active: true,
    }));

    const { error } = await supabase.from("invite_codes").insert(rows);
    if (error) {
      redirect(`/admin/invites?error=${encodeURIComponent(error.message)}`);
    }

    redirect(
      `/admin/invites?success=${encodeURIComponent(
        `已生成 ${count} 个邀请码（每个可用 ${maxUses} 次）✅`
      )}`
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Admin / 邀请码管理</h1>
        <div className="text-sm text-zinc-600">当前管理员：{email}</div>
      </div>

      {errorMsg && <ErrorBanner message={errorMsg} />}
      {successMsg && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {successMsg}
        </div>
      )}

      <Card className="space-y-3">
        <h2 className="font-mono font-semibold text-zinc-600">批量生成邀请码</h2>

        <form action={generateAction} className="grid gap-3 md:grid-cols-3">
          <Input name="count" placeholder="数量（例如 20 / 100）" defaultValue="20" />
          <Input name="max_uses" placeholder="每个可用次数（默认 1）" defaultValue="1" />
          <Input name="prefix" placeholder="前缀（默认 RBK）" defaultValue="RBK" />
          <div className="md:col-span-3">
            <Button type="submit">生成</Button>
          </div>
        </form>

        <div className="text-xs text-zinc-500">
          说明：生成后会出现在下方列表中。数量上限 500/次。
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-medium text-zinc-600">最近生成的 100 个邀请码</h2>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="py-2 font-mono font-semibold text-zinc-600">Code</th>
                <th className="py-2 font-mono font-semibold text-zinc-600">Max</th>
                <th className="py-2 font-mono font-semibold text-zinc-600">Used</th>
                <th className="py-2 font-mono font-semibold text-zinc-600">Active</th>
                <th className="py-2 font-mono font-semibold text-zinc-600">Created</th>
              </tr>
            </thead>
            <tbody>
              {(codes ?? []).map((c: any) => (
                <tr key={c.code} className="border-t">
                  <td className="py-2 font-mono font-semibold text-zinc-400">{c.code}</td>
                  <td className="py-2 text-zinc-400">{c.max_uses}</td>
                  <td className="py-2 text-zinc-400">{c.used_count}</td>
                  <td className="py-2 text-zinc-400">{c.is_active ? "yes" : "no"}</td>
                  <td className="py-2 text-zinc-400">
                    {c.created_at ? new Date(c.created_at).toLocaleString() : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}