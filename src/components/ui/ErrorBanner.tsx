import React from "react";

export function ErrorBanner({
  title = "Something went wrong",
  message,
}: {
  title?: string;
  message?: string | null;
}) {
  if (!message) return null;

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-900">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-sm text-red-800">{message}</div>
    </div>
  );
}