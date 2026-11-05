"use client";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { useState } from "react";
import { ProductDescription } from "@/components/product-description";
import {
  descriptionDocumentFromEditor,
  documentFromPlain,
  editorContentFromDocument,
  parseDescriptionJson,
  type DescriptionDocument,
} from "@/lib/products/description-doc";

const Note = Node.create({
  name: "note",
  group: "block",
  content: "inline*",
  defining: true,
  parseHTML: () => [{ tag: "aside[data-note]" }],
  renderHTML: ({ HTMLAttributes }) => ["aside", mergeAttributes(HTMLAttributes, { "data-note": "true" }), 0],
});

const extensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    blockquote: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    strike: false,
    link: false,
    underline: false,
  }),
  Note,
];

function startingDocument(serialized: string, plain: string): DescriptionDocument | null {
  return (serialized.trim() ? parseDescriptionJson(serialized) : null) ?? documentFromPlain(plain);
}

function ToolButton({
  label,
  pressed,
  disabled,
  onClick,
}: {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-10 border px-3 text-sm ${
        pressed ? "border-forest bg-forest text-ivory" : "border-gold/80 bg-ivory text-forest hover:border-forest"
      } disabled:opacity-40`}
    >
      {label}
    </button>
  );
}

export function DescriptionEditor({
  id,
  description,
  descriptionDocument,
  error,
}: {
  id: string;
  description: string;
  descriptionDocument: string;
  error?: string;
}) {
  const initial = startingDocument(descriptionDocument, description);
  const [serialized, setSerialized] = useState(() => (initial ? JSON.stringify(initial) : ""));
  const [preview, setPreview] = useState<DescriptionDocument | null>(initial);
  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: initial ? editorContentFromDocument(initial) : { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: {
      attributes: {
        class:
          "min-h-48 px-3 py-3 text-base leading-relaxed text-ink outline-none [&_aside]:my-3 [&_aside]:border-l-2 [&_aside]:border-gold [&_aside]:bg-forest/5 [&_aside]:px-3 [&_aside]:py-2 [&_h2]:my-3 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-forest [&_h3]:my-2 [&_h3]:font-serif [&_h3]:text-xl [&_h3]:text-forest [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5",
        "aria-labelledby": `${id}-label`,
        "aria-describedby": error ? `${id}-error` : `${id}-help`,
        "aria-invalid": error ? "true" : "false",
      },
    },
    onUpdate: ({ editor: current }) => {
      const next = descriptionDocumentFromEditor(current.getJSON());
      setPreview(next);
      setSerialized(next ? JSON.stringify(next) : "");
    },
  });
  const activity = useEditorState({
    editor,
    selector: (snapshot) => {
      const current = snapshot.editor;
      if (!current) {
        return null;
      }
      return {
        paragraph: current.isActive("paragraph"),
        h2: current.isActive("heading", { level: 2 }),
        h3: current.isActive("heading", { level: 3 }),
        bold: current.isActive("bold"),
        italic: current.isActive("italic"),
        bullet: current.isActive("bulletList"),
        ordered: current.isActive("orderedList"),
        note: current.isActive("note"),
        undo: current.can().undo(),
        redo: current.can().redo(),
      };
    },
  });

  return (
    <div>
      <p id={`${id}-label`} className="text-sm font-medium text-forest">
        Description
      </p>
      <p id={`${id}-help`} className="mt-2 text-sm text-muted">
        Write in paragraphs. Use the tools for a heading, a list, bold text, or a note.
      </p>
      <div className="mt-3 border border-gold/80 bg-ivory">
        <div className="flex flex-wrap gap-2 border-b border-gold/70 p-2" role="toolbar" aria-label="Description formatting">
          <ToolButton label="Paragraph" pressed={activity?.paragraph} disabled={!editor} onClick={() => editor?.chain().focus().setParagraph().run()} />
          <ToolButton label="Heading" pressed={activity?.h2} disabled={!editor} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} />
          <ToolButton label="Subheading" pressed={activity?.h3} disabled={!editor} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} />
          <ToolButton label="Bold" pressed={activity?.bold} disabled={!editor} onClick={() => editor?.chain().focus().toggleBold().run()} />
          <ToolButton label="Italic" pressed={activity?.italic} disabled={!editor} onClick={() => editor?.chain().focus().toggleItalic().run()} />
          <ToolButton label="Bullets" pressed={activity?.bullet} disabled={!editor} onClick={() => editor?.chain().focus().toggleBulletList().run()} />
          <ToolButton label="Numbered" pressed={activity?.ordered} disabled={!editor} onClick={() => editor?.chain().focus().toggleOrderedList().run()} />
          <ToolButton label="Note" pressed={activity?.note} disabled={!editor} onClick={() => editor?.chain().focus().toggleNode("note", "paragraph").run()} />
          <ToolButton label="Undo" disabled={!editor || !activity?.undo} onClick={() => editor?.chain().focus().undo().run()} />
          <ToolButton label="Redo" disabled={!editor || !activity?.redo} onClick={() => editor?.chain().focus().redo().run()} />
        </div>
        <EditorContent editor={editor} />
      </div>
      <input type="hidden" name="descriptionDocument" value={serialized} />
      {error ? (
        <p id={`${id}-error`} className="mt-2 text-sm text-burgundy">
          {error}
        </p>
      ) : null}
      <div className="mt-4 border border-gold/60 bg-ivory/60 p-4">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-burgundy">Storefront preview</p>
        {preview ? (
          <ProductDescription
            description=""
            document={preview}
            preview
            className="mt-3 max-w-xl space-y-4 text-lg leading-relaxed text-muted"
          />
        ) : (
          <p className="mt-3 text-base text-muted">The description will appear here.</p>
        )}
      </div>
    </div>
  );
}
