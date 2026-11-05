import type { ReactNode } from "react";
import {
  descriptionMatches,
  documentFromPlain,
  type DescriptionDocument,
  type TextRun,
} from "@/lib/products/description-doc";

function RichText({ content }: { content: TextRun[] }) {
  return content.map((run, index) => {
    const pieces = run.text.split("\n").flatMap((piece, pieceIndex) => {
      const nodes: ReactNode[] = pieceIndex > 0 ? [<br key={`${index}-${pieceIndex}`} />] : [];
      if (piece.length > 0) {
        nodes.push(piece);
      }
      return nodes;
    });
    if (run.bold && run.italic) {
      return (
        <strong key={index}>
          <em>{pieces}</em>
        </strong>
      );
    }
    if (run.bold) {
      return <strong key={index}>{pieces}</strong>;
    }
    if (run.italic) {
      return <em key={index}>{pieces}</em>;
    }
    return <span key={index}>{pieces}</span>;
  });
}

export function ProductDescription({
  description,
  document,
  className = "mt-5 max-w-xl space-y-4 text-lg leading-relaxed text-muted",
  preview = false,
}: {
  description: string;
  document?: DescriptionDocument | null;
  className?: string;
  preview?: boolean;
}) {
  const structured = preview && document ? document : document && descriptionMatches(document, description) ? document : documentFromPlain(description);
  if (!structured) {
    return null;
  }
  return (
    <div className={className}>
      {structured.blocks.map((block, index) => {
        if (block.type === "heading") {
          const Tag = block.level === 2 ? "h2" : "h3";
          return (
            <Tag key={index} className={block.level === 2 ? "font-serif text-3xl text-forest" : "font-serif text-2xl text-forest"}>
              <RichText content={block.content} />
            </Tag>
          );
        }
        if (block.type === "bulletList" || block.type === "orderedList") {
          const List = block.type === "bulletList" ? "ul" : "ol";
          return (
            <List key={index} className={block.type === "bulletList" ? "list-disc space-y-2 pl-5" : "list-decimal space-y-2 pl-5"}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <RichText content={item} />
                </li>
              ))}
            </List>
          );
        }
        if (block.type === "note") {
          return (
            <aside key={index} className="border-l-2 border-gold bg-forest/5 px-4 py-3 text-base text-ink">
              <p>
                <RichText content={block.content} />
              </p>
            </aside>
          );
        }
        return (
          <p key={index}>
            <RichText content={block.content} />
          </p>
        );
      })}
    </div>
  );
}
