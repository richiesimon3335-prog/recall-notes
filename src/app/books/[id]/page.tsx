// src/app/books/[id]/page.tsx
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { getBook } from "@/app/actions/books";
import { listNotesByBook, createNote } from "@/app/actions/notes";
import CreateNoteSubmitButton from "@/components/CreateNoteSubmitButton";
import NoteEditor from "@/components/NoteEditor";
import NoteContentEditor from "@/components/NoteContentEditor";

type SearchParams = Record<string, string | string[] | undefined>;

async function unwrapSearchParams(sp: any): Promise<SearchParams> {
  if (!sp) return {};
  if (typeof sp?.then === "function") return await sp; // 兼容 Promise 形式
  return sp as SearchParams;
}

function toSingleString(v: string | string[] | undefined) {
  if (!v) return "";
  return Array.isArray(v) ? v[0] ?? "" : v;
}

export default async function BookDetailPage(props: {
  params: { id: string } | Promise<{ id: string }>;
  searchParams?: any; // ⚠️ 不要写死类型，Next 有时会给 Promise
}) {
  const { id } = await props.params;
  const sp = await unwrapSearchParams(props.searchParams);

  const bookRes = await getBook(id);
  const notesRes = await listNotesByBook(id);

  const errorMsg = toSingleString(sp.error).trim();
  const successMsg = toSingleString(sp.success).trim();

  if (!bookRes.ok) {
    return <ErrorBanner message={bookRes.message} />;
  }

  const book = bookRes.data;

  return (
    <div className="space-y-4">
      {/* 顶部信息 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-zinc-500">
            <Link href="/books" className="hover:underline">
              ← Back to Library
            </Link>
          </div>
          <h1 className="text-xl font-semibold">{book.title}</h1>
          <div className="text-sm text-zinc-600">
            {book.author ? `by ${book.author}` : "—"}{" "}
            {book.source ? `· ${book.source}` : ""}
          </div>
        </div>
      </div>

      {/* 顶部提示 */}
      {errorMsg && <ErrorBanner message={errorMsg} />}
      {successMsg ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {successMsg}
        </div>
      ) : null}

      {/* 新增笔记 */}
      <Card>
        <h2 className="font-medium text-zinc-600">Add a bookmark</h2>

        <p className="mt-1 text-sm text-zinc-500 italic">
          Create the bookmark first. You can add images later from the detail
          page if needed.
        </p>

        <form className="mt-3 space-y-3" action={createNote}>
          <input type="hidden" name="book_id" value={id} />

          <div>
            <label className="text-sm text-zinc-900">Content（required）</label>

            {/* ✅ 这里用 NoteEditor：工具栏 + textarea */}
            <NoteContentEditor
  name="content"
  required
  maxLength={1200}
  placeholder="Write your note..."
  className="
    bg-zinc-100
    text-zinc-900
    border border-zinc-700
    placeholder:text-zinc-500
    focus:border-zinc-500
    focus:ring-0
  "
/>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm text-zinc-600">
                Page Ref（optional）
              </label>
              <Input
                name="page_ref"
                maxLength={40}
                placeholder="e.g. p.12 / chapter 3"
                className="
                  bg-zinc-100
                  text-zinc-900
                  border border-zinc-700
                  placeholder:text-zinc-500
                  focus:border-zinc-500
                  focus:ring-0
                "
              />
            </div>

            <div>
              <label className="text-sm text-zinc-600">Quote（optional）</label>
              <Input
                name="quote"
                maxLength={600}
                placeholder="A short quote..."
                className="
                  bg-zinc-100
                  text-zinc-900
                  border border-zinc-700
                  placeholder:text-zinc-500
                  focus:border-zinc-500
                  focus:ring-0
                "
              />
            </div>
          </div>

          {/* 默认不勾选 */}
          <div className="flex items-center gap-2">
            <input type="checkbox" name="sameBookOnly" className="h-4 w-4" />
            <label className="text-sm text-zinc-500">
              Only link within this book (By default, notes can connect across
              your entire library.)
            </label>
          </div>

          <CreateNoteSubmitButton />
        </form>
      </Card>

      {/* 列表错误 */}
      {!notesRes.ok && <ErrorBanner message={notesRes.message} />}

      {/* 笔记列表 */}
      <div className="space-y-3">
        <h2 className="font-medium">Your bookmarks</h2>

        {notesRes.ok && notesRes.data.length === 0 && (
          <Card>
            <p className="text-sm text-zinc-600">
              No bookmarks yet. Save your first one.
            </p>
          </Card>
        )}

        {notesRes.ok &&
          notesRes.data.map((n: any) => (
            <Card key={n.id} className="space-y-2">
              <div className="text-xs text-zinc-500">
                {new Date(n.created_at).toLocaleString()}
                {n.page_ref ? ` · ${n.page_ref}` : ""}
              </div>

              <div className="whitespace-pre-wrap text-sm text-zinc-600">
                {n.content}
              </div>

              <div className="text-xs text-zinc-500">
                <Link className="hover:underline" href={`/notes/${n.id}`}>
                  View note →
                </Link>
              </div>
            </Card>
          ))}
      </div>
    </div>
  );
}