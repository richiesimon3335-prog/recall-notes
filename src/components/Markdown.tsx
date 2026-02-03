// src/components/Markdown.tsx
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function Markdown({
  children,
  className,
}: {
  children?: string | null;
  className?: string;
}) {
  const text = typeof children === "string" ? children : "";

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className={cn("space-y-2 text-zinc-900", className)}
      components={{
        h1: ({ children }) => (
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mt-3 text-xl font-semibold text-zinc-900">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mt-3 text-lg font-semibold text-zinc-900">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="whitespace-pre-wrap leading-relaxed">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc space-y-1 pl-6">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal space-y-1 pl-6">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-zinc-200 pl-3 text-zinc-700">
            {children}
          </blockquote>
        ),
        code: ({ inline, children }) => {
          if (inline) {
            return (
              <code className="rounded bg-zinc-100 px-1 py-0.5 text-sm">
                {children}
              </code>
            );
          }
          return (
            <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-3 text-sm">
              <code>{children}</code>
            </pre>
          );
        },
      }}
    >
      {text}
    </ReactMarkdown>
  );
}