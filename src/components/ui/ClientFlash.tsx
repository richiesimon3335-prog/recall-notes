"use client";

import { useSearchParams } from "next/navigation";

export function ClientFlash() {
  const sp = useSearchParams();
  const error = (sp.get("error") || "").trim();
  const success = (sp.get("success") || "").trim();

  if (!error && !success) return null;

  const text = error || success;
  const isError = Boolean(error);

  return (
    <div
      className={[
        "rounded-xl border px-4 py-3 text-sm",
        isError
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700",
      ].join(" ")}
    >
      {text}
    </div>
  );
}