// src/app/books/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ClientFlash } from "@/components/ui/ClientFlash";
import { listBooks, createBook, deleteBook } from "@/app/actions/books";
import { signOut } from "@/app/actions/auth";

export default async function BooksPage() {
  const res = await listBooks();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Books, Projects, and Memories
          <span className="block text-zinc-600 font-normal"></span>
Everything you want to remember.</h1>
        <form action={signOut}>
          <Button type="submit" className="bg-zinc-800">
            Sign out
          </Button>
        </form>
      </div>

      {/* ✅ 必显示：从浏览器 URL 直接读 ?error= / ?success= */}
      <ClientFlash />

      <Card>
        <h2 className="font-medium text-zinc-600">Add a book, project, or memory</h2>
        <form className="mt-3 grid gap-3 md:grid-cols-3" action={createBook}>
          <Input name="title" placeholder="Title" required />
          <Input name="author" placeholder="Person/Author" />
          <Input name="source" placeholder="Source/Context" />
          <div className="md:col-span-3">
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Card>

      {!res.ok && <ErrorBanner message={res.message} />}

      <div className="grid gap-3">
        {res.ok && res.data.length === 0 && (
          <Card>
            <p className="text-sm text-zinc-600">
              No books yet. Create your first book.
            </p>
          </Card>
        )}

        {res.ok &&
          res.data.map((b: any) => (
            <Card key={b.id} className="flex items-center justify-between">
              <div>
                <Link
                  className="font-medium text-zinc-600 hover:underline"
                  href={`/books/${b.id}`}
                >
                  {b.title}
                </Link>
                <div className="text-xs text-zinc-500">
                  {b.author ? `by ${b.author}` : "—"}{" "}
                  {b.source ? `· ${b.source}` : ""}
                </div>
              </div>
              <form
                action={async () => {
                  "use server";
                  await deleteBook(b.id);
                }}
              >
                <Button type="submit" className="bg-zinc-900">
                  Delete
                </Button>
              </form>
            </Card>
          ))}
      </div>
    </div>
  );
}