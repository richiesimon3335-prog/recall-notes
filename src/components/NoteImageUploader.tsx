"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function NoteImageUploader(props: {
  noteId: string;
  existingCount: number;
  maxFiles?: number;
}) {
  const router = useRouter();
  const maxFiles = props.maxFiles ?? 3;

  const remaining = useMemo(
    () => Math.max(0, maxFiles - props.existingCount),
    [maxFiles, props.existingCount]
  );

  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function upload() {
    setMsg(null);

    if (remaining <= 0) {
      setMsg(`This note already has ${maxFiles} images.`);
      return;
    }
    if (files.length === 0) {
      setMsg("Please select at least 1 image.");
      return;
    }
    if (files.length > remaining) {
      setMsg(`You can upload at most ${remaining} more image(s).`);
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("note_id", props.noteId);
      for (const f of files) fd.append("files", f);

      const res = await fetch("/api/note-images", { method: "POST", body: fd });
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        setMsg(json?.message || "Upload failed");
        return;
      }

      setFiles([]);
      setMsg("Uploaded ✅");
      router.refresh(); // 刷新 server component，重新拿 signed urls
    } catch (e: any) {
      setMsg(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-3">
      <div className="text-sm font-medium text-zinc-700">Add images</div>
      <div className="mt-1 text-xs text-zinc-500">
        Up to {maxFiles} images per note. (Remaining: {remaining})
      </div>

      <input
        className="mt-3 block w-full text-sm"
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          const list = Array.from(e.target.files ?? []);
          setFiles(list);
        }}
        disabled={busy || remaining <= 0}
      />

      <button
        className="mt-3 rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50"
        onClick={upload}
        disabled={busy || remaining <= 0}
      >
        {busy ? "Uploading..." : "Upload"}
      </button>

      {msg ? (
        <div className="mt-2 text-sm text-zinc-700">{msg}</div>
      ) : null}

      <div className="mt-2 text-xs text-zinc-500">
        Tip: If you uploaded the wrong image, delete this note and create a new one.
      </div>
    </div>
  );
}