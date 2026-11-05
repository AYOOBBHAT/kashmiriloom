export const DESCRIPTION_DOC_VERSION = 1 as const;

const MAX_BLOCKS = 30;
const MAX_LIST_ITEMS = 12;
const MAX_RUNS = 30;
const MAX_RUN_LENGTH = 1000;
const MAX_PLAIN_LENGTH = 2000;
const MAX_JSON_LENGTH = 20_000;

export type TextRun = {
  text: string;
  bold?: true;
  italic?: true;
};

export type DescriptionBlock =
  | { type: "paragraph"; content: TextRun[] }
  | { type: "heading"; level: 2 | 3; content: TextRun[] }
  | { type: "bulletList"; items: TextRun[][] }
  | { type: "orderedList"; items: TextRun[][] }
  | { type: "note"; content: TextRun[] };

export type DescriptionDocument = {
  version: typeof DESCRIPTION_DOC_VERSION;
  blocks: DescriptionBlock[];
};

type EditorNode = {
  type?: unknown;
  text?: unknown;
  attrs?: { level?: unknown };
  marks?: unknown;
  content?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function allowedKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function cleanRun(value: unknown): TextRun | null | undefined {
  if (!isRecord(value) || typeof value.text !== "string" || !allowedKeys(value, ["text", "bold", "italic"])) {
    return null;
  }
  if (value.text.length > MAX_RUN_LENGTH || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value.text)) {
    return null;
  }
  if (value.bold !== undefined && value.bold !== true) {
    return null;
  }
  if (value.italic !== undefined && value.italic !== true) {
    return null;
  }
  if (value.text.length === 0) {
    return undefined;
  }
  return {
    text: value.text,
    ...(value.bold === true ? { bold: true } : {}),
    ...(value.italic === true ? { italic: true } : {}),
  };
}

function cleanRuns(value: unknown): TextRun[] | null {
  if (!Array.isArray(value) || value.length > MAX_RUNS) {
    return null;
  }
  const runs: TextRun[] = [];
  for (const entry of value) {
    const run = cleanRun(entry);
    if (run === null) {
      return null;
    }
    if (run) {
      runs.push(run);
    }
  }
  return runs;
}

function cleanBlock(value: unknown): DescriptionBlock | null | undefined {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null;
  }
  if (value.type === "paragraph" || value.type === "note") {
    if (!allowedKeys(value, ["type", "content"])) {
      return null;
    }
    const content = cleanRuns(value.content);
    if (!content) {
      return content;
    }
    return content.length > 0 ? { type: value.type, content } : undefined;
  }
  if (value.type === "heading") {
    if (!allowedKeys(value, ["type", "level", "content"]) || (value.level !== 2 && value.level !== 3)) {
      return null;
    }
    const content = cleanRuns(value.content);
    if (!content) {
      return content;
    }
    return content.length > 0 ? { type: "heading", level: value.level, content } : undefined;
  }
  if (value.type === "bulletList" || value.type === "orderedList") {
    if (!allowedKeys(value, ["type", "items"]) || !Array.isArray(value.items) || value.items.length > MAX_LIST_ITEMS) {
      return null;
    }
    const items: TextRun[][] = [];
    for (const item of value.items) {
      const runs = cleanRuns(item);
      if (!runs) {
        return runs;
      }
      if (runs.length > 0) {
        items.push(runs);
      }
    }
    return items.length > 0 ? { type: value.type, items } : undefined;
  }
  return null;
}

export function parseDescriptionDocument(value: unknown): DescriptionDocument | null {
  if (!isRecord(value) || !allowedKeys(value, ["version", "blocks"])) {
    return null;
  }
  if (value.version !== DESCRIPTION_DOC_VERSION || !Array.isArray(value.blocks) || value.blocks.length > MAX_BLOCKS) {
    return null;
  }
  const blocks: DescriptionBlock[] = [];
  for (const entry of value.blocks) {
    const block = cleanBlock(entry);
    if (block === null) {
      return null;
    }
    if (block) {
      blocks.push(block);
    }
  }
  if (blocks.length === 0) {
    return null;
  }
  const document = { version: DESCRIPTION_DOC_VERSION, blocks };
  const text = plainText(document);
  if (text.length < 1 || text.length > MAX_PLAIN_LENGTH || JSON.stringify(document).length > MAX_JSON_LENGTH) {
    return null;
  }
  return document;
}

export function parseDescriptionJson(value: string): DescriptionDocument | null {
  if (value.length > MAX_JSON_LENGTH) {
    return null;
  }
  try {
    return parseDescriptionDocument(JSON.parse(value) as unknown);
  } catch {
    return null;
  }
}

function runText(runs: TextRun[]): string {
  return runs.map((run) => run.text).join("");
}

export function plainText(document: DescriptionDocument): string {
  return document.blocks
    .map((block) => {
      if (block.type === "bulletList" || block.type === "orderedList") {
        return block.items.map((item) => runText(item)).join("\n");
      }
      return runText(block.content);
    })
    .join("\n\n");
}

export function descriptionMatches(document: DescriptionDocument, description: string): boolean {
  return plainText(document) === description.trim();
}

export function documentFromPlain(description: string): DescriptionDocument | null {
  const parts = description
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return null;
  }
  return parseDescriptionDocument({
    version: DESCRIPTION_DOC_VERSION,
    blocks: parts.map((part) => ({ type: "paragraph", content: [{ text: part }] })),
  });
}

function marksFor(run: TextRun): { type: string }[] | undefined {
  const marks = [...(run.bold ? [{ type: "bold" }] : []), ...(run.italic ? [{ type: "italic" }] : [])];
  return marks.length > 0 ? marks : undefined;
}

function editorRuns(runs: TextRun[]): EditorNode[] {
  const content: EditorNode[] = [];
  for (const run of runs) {
    const parts = run.text.split("\n");
    parts.forEach((part, index) => {
      if (index > 0) {
        content.push({ type: "hardBreak" });
      }
      if (part.length > 0) {
        content.push({ type: "text", text: part, ...(marksFor(run) ? { marks: marksFor(run) } : {}) });
      }
    });
  }
  return content;
}

export function editorContentFromDocument(document: DescriptionDocument): Record<string, unknown> {
  return {
    type: "doc",
    content: document.blocks.map((block) => {
      if (block.type === "heading") {
        return { type: "heading", attrs: { level: block.level }, content: editorRuns(block.content) };
      }
      if (block.type === "bulletList" || block.type === "orderedList") {
        return {
          type: block.type,
          content: block.items.map((item) => ({
            type: "listItem",
            content: [{ type: "paragraph", content: editorRuns(item) }],
          })),
        };
      }
      return { type: block.type, content: editorRuns(block.content) };
    }),
  };
}

function markFromEditor(value: unknown): { bold?: true; italic?: true } | null {
  if (!Array.isArray(value)) {
    return value === undefined ? {} : null;
  }
  const marks: { bold?: true; italic?: true } = {};
  for (const mark of value) {
    if (!isRecord(mark) || typeof mark.type !== "string") {
      return null;
    }
    if (mark.type === "bold") {
      marks.bold = true;
    } else if (mark.type === "italic") {
      marks.italic = true;
    }
  }
  return marks;
}

function runsFromEditor(nodes: unknown): TextRun[] | null {
  if (nodes === undefined) {
    return [];
  }
  if (!Array.isArray(nodes)) {
    return null;
  }
  const runs: TextRun[] = [];
  for (const node of nodes) {
    if (!isRecord(node) || typeof node.type !== "string") {
      return null;
    }
    if (node.type === "hardBreak") {
      runs.push({ text: "\n" });
      continue;
    }
    if (node.type !== "text" || typeof node.text !== "string") {
      continue;
    }
    const marks = markFromEditor(node.marks);
    if (!marks) {
      return null;
    }
    runs.push({ text: node.text, ...marks });
  }
  return coalesceRuns(runs);
}

function sameMarks(left: TextRun, right: TextRun): boolean {
  return left.bold === right.bold && left.italic === right.italic;
}

function coalesceRuns(runs: TextRun[]): TextRun[] {
  const merged: TextRun[] = [];
  for (const run of runs) {
    const previous = merged.at(-1);
    if (previous && sameMarks(previous, run)) {
      previous.text += run.text;
    } else if (run.text.length > 0) {
      merged.push({ ...run });
    }
  }
  return merged;
}

function listFromEditor(nodes: unknown): TextRun[][] | null {
  if (!Array.isArray(nodes)) {
    return null;
  }
  const items: TextRun[][] = [];
  for (const node of nodes) {
    if (!isRecord(node) || node.type !== "listItem" || !Array.isArray(node.content)) {
      return null;
    }
    const pieces: TextRun[] = [];
    for (const child of node.content) {
      if (!isRecord(child) || child.type !== "paragraph") {
        return null;
      }
      const runs = runsFromEditor(child.content);
      if (!runs) {
        return null;
      }
      if (pieces.length > 0 && runs.length > 0) {
        pieces.push({ text: "\n" });
      }
      pieces.push(...runs);
    }
    const item = coalesceRuns(pieces);
    if (item.length > 0) {
      items.push(item);
    }
  }
  return items;
}

export function descriptionDocumentFromEditor(value: unknown): DescriptionDocument | null {
  if (!isRecord(value) || value.type !== "doc" || !Array.isArray(value.content)) {
    return null;
  }
  const blocks: DescriptionBlock[] = [];
  for (const node of value.content) {
    if (!isRecord(node) || typeof node.type !== "string") {
      return null;
    }
    if (node.type === "paragraph" || node.type === "note") {
      const content = runsFromEditor(node.content);
      if (!content) {
        return null;
      }
      if (content.length > 0) {
        blocks.push({ type: node.type, content });
      }
      continue;
    }
    if (node.type === "heading") {
      const attrs = isRecord(node.attrs) ? node.attrs : {};
      const level = attrs.level === 2 ? 2 : attrs.level === 3 ? 3 : null;
      const content = runsFromEditor(node.content);
      if (!content || level === null) {
        return null;
      }
      if (content.length > 0) {
        blocks.push({ type: "heading", level, content });
      }
      continue;
    }
    if (node.type === "bulletList" || node.type === "orderedList") {
      const items = listFromEditor(node.content);
      if (!items) {
        return null;
      }
      if (items.length > 0) {
        blocks.push({ type: node.type, items });
      }
      continue;
    }
  }
  return parseDescriptionDocument({ version: DESCRIPTION_DOC_VERSION, blocks });
}
