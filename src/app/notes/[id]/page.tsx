// src/app/notes/[id]/page.tsx
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { getNote } from "@/app/actions/notes";
import { getRelatedNotes } from "@/app/actions/noteLinks";
import NoteImageUploader from "@/components/NoteImageUploader";
import { listNoteImages } from "@/app/actions/noteImages";
import NoteImageGallery from "@/components/NoteImageGallery";

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

      <h1 className="text-xl font-semibold">Bookmark</h1>

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

        <div className="whitespace-pre-wrap text-base text-zinc-900">
          {n.content}
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