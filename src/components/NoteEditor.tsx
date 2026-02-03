// src/components/NoteEditor.tsx
"use client";

import { useMemo, useRef, useState } from "react";

type Props = {
  name?: string; // 默认 "content"
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  className?: string; // 传入 textarea 的样式
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** 给选区/光标位置插入文本 */
function insertAt(text: string, start: number, end: number, insertText: string) {
  const a = text.slice(0, start);
  const b = text.slice(end);
  const next = a + insertText + b;
  const cursor = start + insertText.length;
  return { next, selStart: cursor, selEnd: cursor };
}

/** 包裹选区（无选区则插入并把光标放在中间） */
function wrapSelection(
  text: string,
  start: number,
  end: number,
  left: string,
  right: string
) {
  const s = clamp(start, 0, text.length);
  const e = clamp(end, 0, text.length);

  // 有选区：直接包裹
  if (e > s) {
    const selected = text.slice(s, e);
    const next = text.slice(0, s) + left + selected + right + text.slice(e);
    return {
      next,
      selStart: s + left.length,
      selEnd: e + left.length,
    };
  }

  // 无选区：插入 **|** 这种，让光标在中间
  const insertText = left + right;
  const { next, selStart } = insertAt(text, s, e, insertText);
  return {
    next,
    selStart: selStart - right.length,
    selEnd: selStart - right.length,
  };
}

/** 对“当前行/选中多行”加前缀（比如 "- " / "1. "） */
function prefixLines(text: string, start: number, end: number, prefix: string) {
  const s = clamp(start, 0, text.length);
  const e = clamp(end, 0, text.length);

  // 找到选区覆盖的整段行
  const lineStart = text.lastIndexOf("\n", s - 1) + 1;
  const lineEnd = (() => {
    const idx = text.indexOf("\n", e);
    return idx === -1 ? text.length : idx;
  })();

  const block = text.slice(lineStart, lineEnd);
  const lines = block.split("\n");

  const newLines = lines.map((ln) => {
    // 空行也允许加前缀（体验更像“开始列表”）
    return prefix + ln;
  });

  const replaced = newLines.join("\n");
  const next = text.slice(0, lineStart) + replaced + text.slice(lineEnd);

  // 让选区保持覆盖替换块
  const delta = replaced.length - block.length;
  return {
    next,
    selStart: s + prefix.length,
    selEnd: e + delta,
  };
}

/** 缩进：给选中行都加两个空格 */
function indentLines(text: string, start: number, end: number) {
  return prefixLines(text, start, end, "  ");
}

/** 反缩进：去掉每行开头最多两个空格 */
function outdentLines(text: string, start: number, end: number) {
  const s = clamp(start, 0, text.length);
  const e = clamp(end, 0, text.length);

  const lineStart = text.lastIndexOf("\n", s - 1) + 1;
  const lineEnd = (() => {
    const idx = text.indexOf("\n", e);
    return idx === -1 ? text.length : idx;
  })();

  const block = text.slice(lineStart, lineEnd);
  const lines = block.split("\n");

  let removedTotal = 0;
  const newLines = lines.map((ln) => {
    if (ln.startsWith("  ")) {
      removedTotal += 2;
      return ln.slice(2);
    }
    if (ln.startsWith(" ")) {
      removedTotal += 1;
      return ln.slice(1);
    }
    return ln;
  });

  const replaced = newLines.join("\n");
  const next = text.slice(0, lineStart) + replaced + text.slice(lineEnd);

  return {
    next,
    selStart: Math.max(lineStart, s - 2),
    selEnd: Math.max(lineStart, e - removedTotal),
  };
}

export default function NoteEditor({
  name = "content",
  required = false,
  maxLength = 1200,
  placeholder = "Write your note...",
  className = "",
}: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const [value, setValue] = useState<string>("");

  const canType = useMemo(() => value.length <= maxLength, [value, maxLength]);

  function apply(
    fn: (text: string, start: number, end: number) => {
      next: string;
      selStart: number;
      selEnd: number;
    }
  ) {
    const el = ref.current;
    if (!el) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;

    const { next, selStart, selEnd } = fn(value, start, end);
    setValue(next);

    // 等 React 更新后再恢复光标/选区
    requestAnimationFrame(() => {
      const cur = ref.current;
      if (!cur) return;
      cur.focus();
      cur.setSelectionRange(selStart, selEnd);
    });
  }

  return (
    <div className="space-y-2">
      {/* 工具栏 */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
          onClick={() => apply((t, s, e) => insertAt(t, s, e, "→ "))}
          title="Insert arrow"
        >
          → Arrow
        </button>

        <button
          type="button"
          className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
          onClick={() => apply((t, s, e) => prefixLines(t, s, e, "- "))}
          title="Bullet list"
        >
          • Bullet
        </button>

        <button
          type="button"
          className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
          onClick={() => apply((t, s, e) => prefixLines(t, s, e, "1. "))}
          title="Numbered list"
        >
          1. Number
        </button>

        <button
          type="button"
          className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
          onClick={() => apply((t, s, e) => indentLines(t, s, e))}
          title="Indent"
        >
          ↳ Indent
        </button>

        <button
          type="button"
          className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
          onClick={() => apply((t, s, e) => outdentLines(t, s, e))}
          title="Outdent"
        >
          ↰ Outdent
        </button>

        
      </div>

      {/* Textarea（真正提交的字段） */}
      <textarea
        ref={ref}
        name={name}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={className}
      />

      {!canType ? (
        <div className="text-xs text-red-600">
          Too long: max {maxLength} characters.
        </div>
      ) : null}

      
    </div>
  );
}