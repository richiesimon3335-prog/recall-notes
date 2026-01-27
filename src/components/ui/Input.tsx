"use client";

import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
  className={cn(
    "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm",
    "text-zinc-600 placeholder:text-zinc-400",
    "focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-zinc-400",
    className
  )}
  {...props}
/>
  );
}