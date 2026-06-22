"use client";

import { useRef } from "react";
import { TextB, TextItalic, ListBullets } from "@phosphor-icons/react";

/* ============================================================
   RichTextEditor — a deliberately simple, non-technical-friendly
   markdown editor: a textarea with a three-button toolbar
   (Bold, Italic, Bulleted list). Emits MARKDOWN via onChange.
   Wraps/unwraps the selection so theatre admins never have to
   type asterisks themselves.
   ============================================================ */

type Props = {
  value: string;
  onChange: (markdown: string) => void;
  label?: string;
  placeholder?: string;
  rows?: number;
};

export function RichTextEditor({ value, onChange, label, placeholder, rows = 8 }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Wrap the current selection with a marker (e.g. ** for bold).
  const wrap = (marker: string) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || "text";
    const next = value.slice(0, start) + marker + selected + marker + value.slice(end);
    onChange(next);
    // Restore a sensible selection (the wrapped text) after React re-renders.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + marker.length, start + marker.length + selected.length);
    });
  };

  // Turn the lines touched by the selection into bullets ("- ").
  const bulletize = () => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    // Expand selection to whole lines.
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEndIdx = value.indexOf("\n", end);
    const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
    const block = value.slice(lineStart, lineEnd);
    const bulleted = block
      .split("\n")
      .map((l) => (l.trim() === "" ? l : l.startsWith("- ") ? l : `- ${l}`))
      .join("\n");
    const next = value.slice(0, lineStart) + bulleted + value.slice(lineEnd);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(lineStart, lineStart + bulleted.length);
    });
  };

  return (
    <div>
      {label && (
        <label className="block text-xs font-semibold text-curtain-700 tracking-wide mb-2">
          {label}
        </label>
      )}
      <div className="rounded-xl border border-cream-300 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-stage-300 transition">
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-cream-200 bg-cream-50">
          <ToolbarButton label="Bold" onClick={() => wrap("**")}>
            <TextB className="w-4 h-4 text-stage-500" weight="duotone" />
          </ToolbarButton>
          <ToolbarButton label="Italic" onClick={() => wrap("_")}>
            <TextItalic className="w-4 h-4 text-stage-500" weight="duotone" />
          </ToolbarButton>
          <ToolbarButton label="Bulleted list" onClick={bulletize}>
            <ListBullets className="w-4 h-4 text-stage-500" weight="duotone" />
          </ToolbarButton>
        </div>
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="w-full px-3 py-2.5 text-sm text-curtain-900 placeholder:text-clay-400 outline-none resize-y bg-white"
        />
      </div>
      <p className="text-[11px] text-clay-400 mt-1">
        Select text, then tap a button to make it <span className="font-semibold">bold</span> or{" "}
        <span className="italic">italic</span>, or start a bulleted list.
      </p>
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // keep textarea selection
      onClick={onClick}
      aria-label={label}
      title={label}
      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-cream-200 transition-colors"
    >
      {children}
    </button>
  );
}
