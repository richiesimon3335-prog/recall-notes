// src/components/ui/Button.tsx
"use client";

import { cn } from "@/lib/utils";
import * as React from "react";

type ButtonVariant = "primary" | "secondary" | "danger";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({
  className,
  variant = "primary",
  type,
  ...props
}: Props) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50";

  const variants: Record<ButtonVariant, string> = {
    primary: "bg-black text-white hover:opacity-90",
    secondary: "bg-white text-zinc-900 border border-zinc-300 hover:bg-zinc-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };

  // ✅ 默认 button，避免 form 里误触发 submit（你要提交时会写 type="submit"）
  const safeType: React.ButtonHTMLAttributes<HTMLButtonElement>["type"] =
    type ?? "button";

  return (
    <button
      type={safeType}
      className={cn(base, variants[variant], "cursor-pointer", className)}
      {...props}
    />
  );
}