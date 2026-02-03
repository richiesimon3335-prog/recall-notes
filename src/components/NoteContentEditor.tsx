"use client";

import { useRef } from "react";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

type Props = {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  className?: string; // 透传给 Textarea
};

function getLineStart(text: string, pos: number) {
  const i = text.lastIndexOf("\n", pos - 1);
  return i === -1 ? 0 : i + 1;
}

function getLineEnd(text: string, pos: number) {
  const i = text.indexOf("\n", pos);
  return i === -1 ? text.length : i;
}

/** 对选中区域“逐行”加前缀（无选择则对当前行） */
function prefixLines(
  text: string,
  start: number,
  end: number,
  prefix: string,
  mode: "add" | "remove" = "add"
) {
  const a = getLineStart(text, start);
  const b = getLineEnd(text, end);

  const block = text.slice(a, b);
  const lines = block.split("\n");

  const newLines =
    mode === "add"
      ? lines.map((l) => (l.trim().length ? prefix + l : l))
      : lines.map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : l));

  const replaced = newLines.join("\n");
  const nextText = text.slice(0, a) + replaced + text.slice(b);

  const delta = replaced.length - block.length;
  return {
    nextText,
    nextStart: start + (mode === "add" ? prefix.length : 0),
    nextEnd: end + delta,
  };
}

/**
 * ✅ 自动递增编号：
 * - 选中多行 => 1. 2. 3...
 * - 没选中 => 只对当前行编号
 * - 保留缩进
 * - 先移除已有列表前缀，避免叠加
 */
function numberLines(text: string, start: number, end: number) {
  let s = start;
  let e = end;

  if (start === end) {
    const a = getLineStart(text, start);
    const b = getLineEnd(text, start);
    s = a;
    e = b;
  } else {
    s = getLineStart(text, start);
    e = getLineEnd(text, end);
  }

  const before = text.slice(0, s);
  const selected = text.slice(s, e);
  const after = text.slice(e);

  const lines = selected.split("\n");
  let idx = 1;

  const nextLines = lines.map((line) => {
    if (line.trim() === "") return line;

    const indent = line.match(/^\s*/)?.[0] ?? "";
    let rest = line.slice(indent.length);

    rest = rest.replace(/^(\d+[\.\)]\s+|[-*•→]\s+|—\s+|–\s+)+/, "");

    const newLine = `${indent}${idx}. ${rest}`;
    idx += 1;
    return newLine;
  });

  const replaced = nextLines.join("\n");
  const nextText = before + replaced + after;

  return {
    nextText,
    nextStart: s,
    nextEnd: s + replaced.length,
  };
}

export default function NoteContentEditor({
  name,
  defaultValue = "",
  placeholder,
  maxLength,
  required,
  className,
}: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const setValueAndCursor = (nextText: string, cursorPos: number) => {
    const el = ref.current;
    if (!el) return;

    el.value = nextText;
    el.dispatchEvent(new Event("input", { bubbles: true }));

    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursorPos, cursorPos);
    });
  };

  const apply = (
    fn: (text: string, s: number, e: number) => {
      nextText: string;
      nextStart: number;
      nextEnd: number;
    }
  ) => {
    const el = ref.current;
    if (!el) return;

    const text = el.value ?? "";
    const s = el.selectionStart ?? 0;
    const e = el.selectionEnd ?? 0;

    const { nextText, nextStart, nextEnd } = fn(text, s, e);

    el.value = nextText;
    el.dispatchEvent(new Event("input", { bubbles: true }));

    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(nextStart, nextEnd);
    });
  };

  const addArrow = () => apply((t, s, e) => prefixLines(t, s, e, "→ ", "add"));
  const addBullet = () => apply((t, s, e) => prefixLines(t, s, e, "• ", "add"));
  const addNumber = () => apply((t, s, e) => numberLines(t, s, e));
  const indent = () => apply((t, s, e) => prefixLines(t, s, e, "  ", "add"));
  const outdent = () => apply((t, s, e) => prefixLines(t, s, e, "  ", "remove"));

  /**
   * ✅ Enter 自动续写：
   * - Arrow: "→ "
   * - Bullet: "• "（也兼容 "- "、"* "）
   * - Number: "7. " -> 下一行 "8. "
   * 规则：
   * - 只在光标位于行尾时触发（更符合预期）
   * - 当前行只有前缀时，Enter 结束列表（不续写）
   */
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return;
    if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
    // ✅ 避免输入法（中文/日文）组合输入时误触发 Enter 逻辑
const native = e.nativeEvent as unknown as { isComposing?: boolean; keyCode?: number };
if (native.isComposing || native.keyCode === 229) return;

    const el = ref.current;
    if (!el) return;

    const text = el.value ?? "";
    const pos = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;

    // 有选区时先让浏览器正常换行（避免复杂行为）
    if (pos !== end) return;

    const lineStart = getLineStart(text, pos);
    const lineEnd = getLineEnd(text, pos);

    // 只在“行尾”时续写，行中间回车就交给原生行为
    if (pos !== lineEnd) return;

    const line = text.slice(lineStart, lineEnd);

    // 识别缩进
    const indentMatch = line.match(/^\s*/);
    const indentStr = indentMatch?.[0] ?? "";
    const rest = line.slice(indentStr.length);

    // 1) Number: "7. xxx" -> 下一行 "8. "
    const numMatch = rest.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      const currentNum = Number(numMatch[1]);
      const contentAfter = numMatch[2] ?? "";

      e.preventDefault();

      // 如果这一行只有 "7. " 没内容：结束编号
      if (contentAfter.trim().length === 0) {
        const before = text.slice(0, lineStart);
        const after = text.slice(lineEnd);
        const nextLine = indentStr; // 去掉编号
        const nextText = before + nextLine + "\n" + after;
        const nextPos = (before + nextLine + "\n").length;
        return setValueAndCursor(nextText, nextPos);
      }

      const nextPrefix = `${indentStr}${currentNum + 1}. `;
      const before = text.slice(0, pos);
      const after = text.slice(pos);
      const insert = "\n" + nextPrefix;
      const nextText = before + insert + after;
      const nextPos = before.length + insert.length;
      return setValueAndCursor(nextText, nextPos);
    }

    // 2) Arrow: "→ xxx" -> 下一行 "→ "
    if (rest.startsWith("→ ")) {
      e.preventDefault();

      const afterMarker = rest.slice(2); // 去掉 "→ "
      if (afterMarker.trim().length === 0) {
        // 只有 "→ "：结束列表（移除 marker）
        const before = text.slice(0, lineStart);
        const after = text.slice(lineEnd);
        const nextLine = indentStr;
        const nextText = before + nextLine + "\n" + after;
        const nextPos = (before + nextLine + "\n").length;
        return setValueAndCursor(nextText, nextPos);
      }

      const nextPrefix = `${indentStr}→ `;
      const before = text.slice(0, pos);
      const after = text.slice(pos);
      const insert = "\n" + nextPrefix;
      const nextText = before + insert + after;
      const nextPos = before.length + insert.length;
      return setValueAndCursor(nextText, nextPos);
    }

    // 3) Bullet: "• xxx" 或 "- xxx" 或 "* xxx" -> 下一行同样的 bullet
    const bulletMatch = rest.match(/^([•\-\*])\s+(.*)$/);
    if (bulletMatch) {
      const marker = bulletMatch[1]; // • 或 - 或 *
      const contentAfter = bulletMatch[2] ?? "";

      e.preventDefault();

      if (contentAfter.trim().length === 0) {
        // 只有 "• "：结束列表
        const before = text.slice(0, lineStart);
        const after = text.slice(lineEnd);
        const nextLine = indentStr;
        const nextText = before + nextLine + "\n" + after;
        const nextPos = (before + nextLine + "\n").length;
        return setValueAndCursor(nextText, nextPos);
      }

      const nextPrefix = `${indentStr}${marker} `;
      const before = text.slice(0, pos);
      const after = text.slice(pos);
      const insert = "\n" + nextPrefix;
      const nextText = before + insert + after;
      const nextPos = before.length + insert.length;
      return setValueAndCursor(nextText, nextPos);
    }
  };

  return (
    <div className="space-y-2">
      {/* 工具条 */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="bg-white text-zinc-800 border border-zinc-200 hover:bg-zinc-50"
          onClick={addArrow}
        >
          → Arrow
        </Button>

        <Button
          type="button"
          className="bg-white text-zinc-800 border border-zinc-200 hover:bg-zinc-50"
          onClick={addBullet}
        >
          • Bullet
        </Button>

        <Button
          type="button"
          className="bg-white text-zinc-800 border border-zinc-200 hover:bg-zinc-50"
          onClick={addNumber}
        >
          1. Number
        </Button>

        <Button
          type="button"
          className="bg-white text-zinc-800 border border-zinc-200 hover:bg-zinc-50"
          onClick={indent}
        >
          ↳ Indent
        </Button>

        <Button
          type="button"
          className="bg-white text-zinc-800 border border-zinc-200 hover:bg-zinc-50"
          onClick={outdent}
        >
          ↰ Outdent
        </Button>
      </div>

      {/* 输入框 */}
      <Textarea
        ref={ref}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        className={className}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}