"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-[120px] w-full rounded-xl px-3 py-2 text-sm",
          "border border-zinc-200 bg-white text-zinc-900",
          "placeholder:text-zinc-400",
          "focus:outline-none focus:ring-2 focus:ring-zinc-200",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";

// ✅ 同时支持两种引入方式：
// import { Textarea } from "..."
// import Textarea from "..."
export { Textarea };
export default Textarea;