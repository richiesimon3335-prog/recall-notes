export type EmbeddingResult = number[];

function mustGetEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function createEmbedding(input: string): Promise<EmbeddingResult> {
  const apiKey = mustGetEnv("OPENAI_API_KEY");
  const model = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Embeddings API error: ${resp.status} ${text}`);
  }

  const json = await resp.json();
  return json.data?.[0]?.embedding as number[];
}

export async function chatAnswer(args: {
  question: string;
  context: string;
}): Promise<string> {
  const apiKey = mustGetEnv("OPENAI_API_KEY");
  const model = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "你是我的读书笔记知识库助手。请用中文回答，优先基于提供的笔记上下文；不确定就明确说不确定。回答后给出引用（用 note_id / book_title 标注）。",
        },
        {
          role: "user",
          content: `问题：${args.question}\n\n可用笔记（请只基于这些）：\n${args.context}`,
        },
      ],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Chat API error: ${resp.status} ${text}`);
  }

  const json = await resp.json();
  return (json.choices?.[0]?.message?.content as string) || "";
}