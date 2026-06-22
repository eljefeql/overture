"use client";

import { Fragment, type ReactNode } from "react";

/* ============================================================
   Markdown — a SAFE, tiny markdown renderer.

   Parses only a deliberately small subset:
     - **bold**
     - _italic_  /  *italic*
     - "- " bulleted lists
   Everything else renders as plain, escaped text. We build the
   React element tree directly — NEVER dangerouslySetInnerHTML —
   so user input can never inject markup.
   ============================================================ */

type Props = {
  /** The markdown source (as emitted by RichTextEditor). */
  children: string | null | undefined;
  className?: string;
};

/** Parse inline marks (**bold**, _italic_, *italic*) into React nodes. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Match **bold** first (longest), then _italic_ or *italic*.
  const pattern = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const bold = match[2] ?? match[3];
    const italic = match[4] ?? match[5];
    if (bold != null) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${i}`} className="font-semibold text-curtain-900">
          {bold}
        </strong>
      );
    } else if (italic != null) {
      nodes.push(
        <em key={`${keyPrefix}-i-${i}`} className="italic">
          {italic}
        </em>
      );
    }
    lastIndex = pattern.lastIndex;
    i++;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

export function Markdown({ children, className }: Props) {
  const source = (children ?? "").replace(/\r\n/g, "\n");
  if (!source.trim()) return null;

  const lines = source.split("\n");
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let paragraph: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(" ");
    blocks.push(
      <p key={`p-${key++}`} className="text-sm text-curtain-800 leading-relaxed">
        {renderInline(text, `p${key}`)}
      </p>
    );
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    const items = listItems;
    blocks.push(
      <ul key={`ul-${key++}`} className="list-disc pl-5 flex flex-col gap-1">
        {items.map((item, idx) => (
          <li key={idx} className="text-sm text-curtain-800 leading-relaxed">
            {renderInline(item, `li${key}-${idx}`)}
          </li>
        ))}
      </ul>
    );
    listItems = [];
  };

  for (const line of lines) {
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      listItems.push(bullet[1]);
      continue;
    }
    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();

  return (
    <div className={`flex flex-col gap-3 ${className ?? ""}`}>
      {blocks.map((b, i) => (
        <Fragment key={i}>{b}</Fragment>
      ))}
    </div>
  );
}
