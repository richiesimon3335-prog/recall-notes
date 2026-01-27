// src/app/ask/ui/AskClient.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

function SkeletonResultCard() {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="h-3 w-40 rounded bg-zinc-200" />
          <div className="mt-3 space-y-2">
            <div className="h-3 w-full rounded bg-zinc-200" />
            <div className="h-3 w-11/12 rounded bg-zinc-200" />
            <div className="h-3 w-7/12 rounded bg-zinc-200" />
          </div>
          <div className="mt-4 flex gap-4">
            <div className="h-3 w-24 rounded bg-zinc-200" />
            <div className="h-3 w-24 rounded bg-zinc-200" />
          </div>
        </div>

        <div className="shrink-0">
          <div className="h-6 w-24 rounded-full bg-zinc-200" />
        </div>
      </div>
    </Card>
  );
}

export default function AskClient({ initialQ }: { initialQ: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [isPending, startTransition] = useTransition();

  const canSearch = useMemo(() => q.trim().length > 0, [q]);

  function onSearch() {
    const query = q.trim();
    if (!query) return;

    startTransition(() => {
      router.push(`/ask?q=${encodeURIComponent(query)}`);
    });
  }

  return (
    <div>
      <Card className="p-4">
        <div className="flex gap-3">
          <Input
            name="q"
            placeholder="What have I learned about relationships?"
            value={q}
            onChange={(e: any) => setQ(e.target.value)}
            onKeyDown={(e: any) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSearch();
              }
            }}
          />
          <Button type="button" onClick={onSearch} disabled={!canSearch}>
            {isPending ? "Searching..." : "Search"}
          </Button>
        </div>

        <div className="mt-2 text-xs text-zinc-500">
          Tip: You can also ask via URL：<span className="font-mono">/ask?q=...</span>
        </div>
      </Card>

      {/* ✅ Level 1 Skeleton：只要在跳转中，就展示 3 张占位 */}
      {isPending && (
        <div className="mt-6 space-y-3">
          <SkeletonResultCard />
          <SkeletonResultCard />
          <SkeletonResultCard />
        </div>
      )}
    </div>
  );
}