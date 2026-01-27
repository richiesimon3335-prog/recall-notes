"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/app/actions/auth";
import { createEmbedding, chatAnswer } from "@/lib/openai";

export async function askWithRAG(question: string, topK = 8) {
  const user = await requireUser();
  const supabase = await createSupabaseServer();

  const q = question.trim();
  if (!q) return { ok: true as const, answer: "", sources: [] as any[] };

  // 1) embed question
  const qEmbedding = await createEmbedding(q);

  // 2) vector search via RPC
  const { data, error } = await supabase.rpc("match_notes", {
    query_embedding: qEmbedding,
    match_count: topK,
  });

  if (error) return { ok: false as const, message: error.message };

  const sources = (data || []).map((r: any) => ({
    note_id: r.note_id,
    book_id: r.book_id,
    book_title: r.book_title,
    page_ref: r.page_ref,
    quote: r.quote,
    similarity: r.similarity,
    content: r.content,
  }));

  // 3) build context (keep it short)
  const context = sources
    .map((s: any, idx: number) => {
      return `#${idx + 1}
book_title: ${s.book_title}
note_id: ${s.note_id}
page_ref: ${s.page_ref || "-"}
quote: ${s.quote || "-"}
content: ${String(s.content).slice(0, 1200)}
similarity: ${s.similarity}`;
    })
    .join("\n\n");

  // 4) ask model to answer with citations
  const answer = await chatAnswer({ question: q, context });

  // 5) return answer + sources (without full content)
  const compactSources = sources.map((s: any) => ({
    note_id: s.note_id,
    book_id: s.book_id,
    book_title: s.book_title,
    page_ref: s.page_ref,
    similarity: s.similarity,
  }));

  return { ok: true as const, answer, sources: compactSources };
}