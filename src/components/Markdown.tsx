// src/components/Markdown.tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

type Props = {
  children: string;
  className?: string;
};

export default function Markdown({ children, className }: Props) {
  return (
    // ✅ 把 className 放到外层容器，避免 react-markdown 版本差异导致 TS 报错
    <div className={cn("space-y-2 text-zinc-900", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
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
            <h3 className="mt-2 text-lg font-semibold text-zinc-900">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="leading-7">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-6">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6">{children}</ol>,
          li: ({ children }) => <li className="my-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-zinc-300 pl-4 italic text-zinc-700">
              {children}
            </blockquote>
          ),
          a: ({ children, ...props }) => (
            <a
              {...props}
              className="underline underline-offset-4 hover:text-zinc-700"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.95em]">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded bg-zinc-100 p-3">
              {children}
            </pre>
          ),
          hr: () => <hr className="my-4 border-zinc-200" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}