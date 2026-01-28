"use client";

import { useEffect, useMemo, useState } from "react";

type Img = {
  id: string;
  kind: "thumb" | "full";
  url: string; // signed url
  width?: number | null;
  height?: number | null;
};

export default function NoteImageGallery(props: { images: Img[] }) {
  // 只展示 thumb（列表更快），但弹窗里也先用 thumb url（如果你后面把 fullUrl 也传进来，可以再升级）
  const thumbs = useMemo(
    () => props.images.filter((x) => x.kind === "thumb"),
    [props.images]
  );

  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  function close() {
    setOpen(false);
  }

  function openAt(i: number) {
    setIdx(i);
    setOpen(true);
  }

  function prev() {
    setIdx((v) => (v - 1 + thumbs.length) % thumbs.length);
  }

  function next() {
    setIdx((v) => (v + 1) % thumbs.length);
  }

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, thumbs.length]);

  if (thumbs.length === 0) return null;

  const active = thumbs[idx];

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-zinc-700">Images</div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {thumbs.map((img, i) => (
          <button
            key={img.id}
            type="button"
            className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white"
            onClick={() => openAt(i)}
            title="Open image"
          >
            {/* 用普通 img 最稳，避免 next/image 额外配置 */}
            <img
              src={img.url}
              alt="note image"
              className="h-44 w-full object-cover"
              loading="lazy"
            />
            <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
              <div className="absolute inset-0 bg-black/10" />
              <div className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-1 text-xs text-white">
                Click to preview
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(e) => {
            // 点击背景关闭（点到内容区域不关闭）
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="relative w-full max-w-5xl">
            <button
              type="button"
              onClick={close}
              className="absolute right-0 top-0 -translate-y-12 rounded-lg bg-black/70 px-3 py-2 text-sm text-white hover:bg-black"
            >
              ✕ Close
            </button>

            <div className="overflow-hidden rounded-2xl bg-black">
              <img
                src={active.url}
                alt="preview"
                className="max-h-[80vh] w-full object-contain"
              />
            </div>

            {thumbs.length > 1 && (
              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={prev}
                  className="rounded-lg bg-black/70 px-3 py-2 text-sm text-white hover:bg-black"
                >
                  ← Prev
                </button>
                <div className="text-sm text-white/80">
                  {idx + 1} / {thumbs.length}
                </div>
                <button
                  type="button"
                  onClick={next}
                  className="rounded-lg bg-black/70 px-3 py-2 text-sm text-white hover:bg-black"
                >
                  Next →
                </button>
              </div>
            )}

            <div className="mt-2 text-center text-xs text-white/60">
              Tip: ESC 关闭 · ← → 切换
            </div>
          </div>
        </div>
      )}
    </div>
  );
}