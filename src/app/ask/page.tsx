// src/app/ask/page.tsx
import Link from "next/link";
import AskClient from "./ui/AskClient";
import { semanticSearchNotes } from "@/app/actions/search";
import { Card } from "@/components/ui/Card";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

type SearchParams = Record<string, string | string[] | undefined>;

async function unwrapSearchParams(sp: any): Promise<SearchParams> {
  if (!sp) return {};
  if (typeof sp?.then === "function") return await sp;
  return sp as SearchParams;
}

function toSingleString(v: string | string[] | undefined): string {
  if (!v) return "";
  return Array.isArray(v) ? v[0] ?? "" : v;
}

function formatSimilarity(sim: number | null | undefined) {
  if (sim == null) return "";
  const pct = Math.round(sim * 100);
  return `${pct}%`;
}

export default async function AskPage(props: { searchParams?: any }) {
  const sp = await unwrapSearchParams(props.searchParams);
  const q = toSingleString(sp.q).trim();

  const res =
    q.length > 0
      ? await semanticSearchNotes(q)
      : ({ ok: true, results: [] } as const);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-zinc-500">Ask/Recall your past self</h1>

        {/* 这里用 <br/> 强制换行 */}
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
          Ask in natural language.  
Recall brings your past notes/thoughts back when you need them.
          <br />
          No keywords. Just ask.
        </p>
      </div>

      {/* ✅ 搜索框：改为 Client 组件，才能做 loading skeleton */}
      <AskClient initialQ={q} />

      {/* 错误展示 */}
      {!res.ok && (
        <div className="mt-4">
          <ErrorBanner
            title="Search failed / 搜索失败"
            message={res.message || "Unknown error"}
          />
        </div>
      )}

      {/* 结果列表 */}
      <div className="mt-6">
        <div className="mb-3 flex items-end justify-between">
          <div className="text-sm text-zinc-600">
            What Recall found:{" "}
            <span className="font-medium text-zinc-900">
        {q}</span>
          </div>

          {res.ok && q && (
            <div className="text-xs text-zinc-500">
              Found {res.results.length} result(s)
            </div>
          )}
        </div>

        {res.ok && q && res.results.length === 0 && (
          <Card className="p-4">
            <div className="text-sm text-zinc-700">
              没找到相关内容。你可以：
              <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-600">
                <li>换一种问法（更具体/更口语）</li>
                <li>先多写几条笔记（有 embedding 才能语义命中）</li>
                <li>确认新笔记的 embedding 列不是 NULL</li>
              </ul>
            </div>
          </Card>
        )}

        <div className="space-y-3">
          {res.ok &&
            res.results.map((n: any) => (
              <Card key={n.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs text-zinc-500">
                      {n.created_at
                        ? new Date(n.created_at).toLocaleString()
                        : ""}
                    </div>

                    <div className="mt-2 whitespace-pre-wrap text-sm text-zinc-900">
                      {n.content}
                    </div>

                    <div className="mt-3 flex gap-4 text-sm">
                      <Link
                        className="text-zinc-900 underline underline-offset-4"
                        href={`/notes/${n.id}`}
                      >
                        View note →
                      </Link>
                      <Link
                        className="text-zinc-900 underline underline-offset-4"
                        href={`/books/${n.book_id}`}
                      >
                        View book →
                      </Link>
                    </div>
                  </div>

                  <div className="shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700">
                    Similarity:{" "}
                    <span className="font-semibold">
                      {formatSimilarity(n.similarity)}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
        </div>
      </div>
    </div>
  );
}