"use client";

import { cn } from "@/lib/utils";
import type { TextareaHTMLAttributes } from "react";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-zinc-300 min-h-[120px]",
        className
      )}
      {...props}
    />
  );
}