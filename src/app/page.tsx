export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-10">
      {/* Hero */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-10 shadow-sm">
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-semibold text-zinc-900 leading-tight">
              📚 Talk to the bookmarks you left years ago.
            </h1>

            <p className="mt-4 max-w-2xl text-zinc-700 text-base leading-relaxed">
              Recall helps you remember what you once thought was important.
            </p>

            <p className="mt-3 text-sm text-zinc-500">
              Notes are just the start.
RECALL understands your thoughts and helps you recall and connect knowledge across time.
Every note brings relevant ideas back into view.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="/books"
              className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
            >
              ADD A BOOKMARK/NOTE →
            </a>

            <a
              href="/ask"
              className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              RECALL/ASK
            </a>
          </div>
        </div>
      </section>

      {/* What it does */}
      <section className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="font-medium text-zinc-900">✍️ Natural Notes</h3>
          <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
            No tags. No keywords.
Write your thoughts naturally, in your own words.
Recall understands meaning, not structure.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="font-medium text-zinc-900">🧠 AI Connections</h3>
          <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
            AI understands what your notes mean
and automatically connects related ideas
across different books and moments in time.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="font-medium text-zinc-900">🔍 Recall Anytime</h3>
          <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
            Search your past notes with natural language.
Open any note to instantly see related notes
and where they came from.
          </p>
        </div>
      </section>
    </div>
  );
}