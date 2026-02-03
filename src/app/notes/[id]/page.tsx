// src/app/notes/[id]/page.tsx
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { getNote } from "@/app/actions/notes";
import { getRelatedNotes } from "@/app/actions/noteLinks";
import NoteImageUploader from "@/components/NoteImageUploader";
import { listNoteImages } from "@/app/actions/noteImages";
import NoteImageGallery from "@/components/NoteImageGallery";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default async function NoteDetailPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 1) 当前笔记
  const res = await getNote(id);
  if (!res.ok) return <ErrorBanner message={res.message} />;
  const n = res.data;

  // 2) 相关笔记
  const related = await getRelatedNotes(id);

  // 3) 读取图片 + signed urls
  const imgsRes = await listNoteImages(id);
  const allImages = imgsRes.ok ? imgsRes.images : [];

  const thumbs = allImages.filter((x: any) => x.kind === "thumb");
  // ✅ existingCount 用 thumb 数量（因为每张图=1个thumb + 1个full）
  const existingCount = thumbs.length;

  return (
    <div className="space-y-4">
      <div className="text-sm text-zinc-500">
        <Link href={`/books/${n.book_id}`} className="hover:underline">
          ← Back to this book
        </Link>
      </div>

      <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Bookmark</h1>
          <Link
              href={`/notes/${id}/edit`}
              className="text-sm text-zinc-600 hover:text-zinc-900 underline underline-offset-4"
          >
              Edit
          </Link>
      </div>

      <Card className="space-y-3">
        <div className="text-xs text-zinc-500">
          {new Date(n.created_at).toLocaleString()}
          {n.page_ref ? ` · ${n.page_ref}` : ""}
        </div>

        {/* ✅ 上传区：放在 note 详情里，noteId 永远真实 */}
        <NoteImageUploader noteId={id} existingCount={existingCount} maxFiles={3} />

        {/* ✅ 图片展示区：改为点击弹窗预览（不打开新标签页） */}
        {imgsRes.ok ? (
          <div className="pt-2">
            <NoteImageGallery images={allImages} />
            {thumbs.length > 0 ? (
              <div className="mt-2 text-xs text-zinc-500">
                Tip: Click a thumbnail to preview. (Signed links expire in 1 hour)
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-sm text-red-600">
            Load images failed: {imgsRes.message}
          </div>
        )}

        {n.quote ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 italic">
            “{n.quote}”
          </div>
        ) : null}

        <div className="text-base text-zinc-900">
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      h1: (props) => <h1 className="mt-4 mb-2 text-2xl font-semibold" {...props} />,
      h2: (props) => <h2 className="mt-4 mb-2 text-xl font-semibold" {...props} />,
      h3: (props) => <h3 className="mt-3 mb-2 text-lg font-semibold" {...props} />,
      p: (props) => <p className="mb-3 leading-7" {...props} />,
      ul: (props) => <ul className="mb-3 list-disc pl-6" {...props} />,
      ol: (props) => <ol className="mb-3 list-decimal pl-6" {...props} />,
      li: (props) => <li className="mb-1" {...props} />,
      blockquote: (props) => (
        <blockquote
          className="my-3 border-l-4 border-zinc-300 pl-4 italic text-zinc-700"
          {...props}
        />
      ),
      strong: (props) => <strong className="font-semibold" {...props} />,
      em: (props) => <em className="italic" {...props} />,
      a: (props) => (
        <a className="underline underline-offset-4 hover:text-zinc-700" {...props} />
      ),
      code: (props) => (
        <code
          className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.95em]"
          {...props}
        />
      ),
      pre: (props) => (
        <pre className="mb-3 overflow-x-auto rounded bg-zinc-100 p-3" {...props} />
      ),
      hr: (props) => <hr className="my-4 border-zinc-200" {...props} />,
    }}
  >
    {String(n.content ?? "")}
  </ReactMarkdown>
</div>

        <div className="pt-2 text-xs text-zinc-600">
          Related ideas: {(n.topics ?? []).join(", ") || "—"}
          <br />
          Key themes: {(n.keywords ?? []).join(", ") || "—"}
        </div>
      </Card>

      {/* Related notes */}
      {related.ok && related.results.length > 0 ? (
        <div className="pt-2">
          <h2 className="mb-2 text-sm font-semibold text-zinc-700">
            Related bookmarks
          </h2>

          <div className="space-y-3">
            {related.results.map((r: any) => (
              <Card key={r.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-zinc-500">
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                  <div className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600">
                    Highly related: {Math.round((r.score ?? 0) * 100)}%
                  </div>
                </div>

                <div className="whitespace-pre-wrap text-sm text-zinc-800">
                  {String(r.content ?? "").slice(0, 240)}
                  {String(r.content ?? "").length > 240 ? "…" : ""}
                </div>

                <div className="flex gap-4 text-sm">
                  <Link
                    className="font-medium text-zinc-600 hover:text-zinc-900 underline underline-offset-4"
                    href={`/notes/${r.id}`}
                  >
                    Open bookmark →
                  </Link>
                  <Link
                    className="font-medium text-zinc-600 hover:text-zinc-900 underline underline-offset-4"
                    href={`/books/${r.book_id}`}
                  >
                    Open book →
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}