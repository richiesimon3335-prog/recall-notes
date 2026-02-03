"use client";

import { useRef } from "react";

export default function DeleteNoteButton(props: {
  action: (formData: FormData) => Promise<void>;
  noteId: string;
  bookId: string;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);

  return (
    <form
      ref={formRef}
      action={props.action}
      onSubmit={(e) => {
        // ✅ confirm 必须在 client 做
        const ok = confirm("Delete this note? This cannot be undone.");
        if (!ok) e.preventDefault();
      }}
      className="inline"
    >
      <input type="hidden" name="note_id" value={props.noteId} />
      <input type="hidden" name="book_id" value={props.bookId} />

      <button
        type="submit"
        className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
      >
        Delete note
      </button>
    </form>
  );
}