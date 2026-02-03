// src/app/notes/[id]/edit/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { getNote, updateNote, deleteNote } from "@/app/actions/notes";
import DeleteNoteButton from "@/components/DeleteNoteButton";
import NoteContentEditor from "@/components/NoteContentEditor";

type SearchParams = Record<string, string | string[] | undefined>;

async function unwrapSearchParams(sp: any): Promise<SearchParams> {
  if (!sp) return {};
  if (typeof sp?.then === "function") return await sp;
  return sp as SearchParams;
}

function toSingleString(v: string | string[] | undefined) {
  if (!v) return "";
  return Array.isArray(v) ? v[0] ?? "" : v;
}

export default async function NoteEditPage(props: {
  params: { id: string } | Promise<{ id: string }>;
  searchParams?: any;
}) {
  const { id } = await props.params;
  const sp = await unwrapSearchParams(props.searchParams);

  const errorMsg = toSingleString(sp.error).trim();
  const successMsg = toSingleString(sp.success).trim();

  const res = await getNote(id);
  if (!res.ok) {
    redirect(`/books?error=${encodeURIComponent(res.message)}`);
  }
  const n = res.data;

  return (
    <div className="space-y-4">
      <div className="text-sm text-zinc-500">
        <Link href={`/notes/${id}`} className="hover:underline">
          ← Back to bookmark
        </Link>
      </div>

      <h1 className="text-xl font-semibold">Edit bookmark</h1>

      {errorMsg && <ErrorBanner message={errorMsg} />}
      {successMsg && <ErrorBanner message={successMsg} />}

      <Card className="space-y-4">
        {/* ✅ 表单 1：更新 */}
        <form className="space-y-3" action={updateNote}>
          <input type="hidden" name="note_id" value={id} />

          <div>
            <label className="text-sm text-zinc-900">Content (required)</label>

            {/* ✅ 核心：用 NoteContentEditor 替换 Textarea，这样 edit 页也有快捷按钮 */}
            <NoteContentEditor
              name="content"
              required
              maxLength={1200}
              defaultValue={String(n.content ?? "")}
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
              <label className="text-sm text-zinc-600">Page Ref (optional)</label>
              <Input
                name="page_ref"
                maxLength={40}
                defaultValue={String(n.page_ref ?? "")}
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
              <label className="text-sm text-zinc-600">Quote (optional)</label>
              <Input
                name="quote"
                maxLength={600}
                defaultValue={String(n.quote ?? "")}
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

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="sameBookOnly"
              defaultChecked={!!n.same_book_only}
              className="h-4 w-4"
            />
            <label className="text-sm text-zinc-700">
              Link within this book only (Turn off to link across all books and memories.)
            </label>
          </div>

          <div className="flex gap-2">
            <Button type="submit">Save changes</Button>

            <Link href={`/notes/${id}`} className="inline-flex">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
          </div>
        </form>

        {/* ✅ 分隔线 */}
        <div className="border-t border-zinc-200 pt-4 flex items-center justify-between">
          <div className="text-xs text-zinc-500">Tip: Deleting a note is permanent.</div>

          {/* ✅ 表单 2：删除（注意：不在上面那个 form 里面） */}
          <DeleteNoteButton action={deleteNote} noteId={id} bookId={n.book_id} />
        </div>
      </Card>
    </div>
  );
}