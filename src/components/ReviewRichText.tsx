import type { ReactNode } from "react";
import {
  parseReviewContent,
  type ReviewInline,
} from "@/features/social/review-content";
import { ReviewVideo } from "./ReviewVideo";
import { cn } from "@/lib/utils";

function spans(inline: ReviewInline[], showLinks: boolean) {
  return inline.map((part, index) => {
    let text: ReactNode = part.text;
    if (part.bold) text = <strong>{text}</strong>;
    if (part.italic) text = <em>{text}</em>;
    if (part.underline) text = <u>{text}</u>;
    return showLinks && part.href ? (
      <a
        key={index}
        href={part.href}
        rel="noreferrer"
        target="_blank"
        className="text-primary underline"
      >
        {text}
      </a>
    ) : (
      <span key={index}>{text}</span>
    );
  });
}

export function ReviewRichText({
  content,
  fallback,
  locale = "en",
  className,
  showMedia = true,
  showLinks = true,
}: {
  content?: unknown;
  fallback: string;
  locale?: string;
  className?: string;
  showMedia?: boolean;
  showLinks?: boolean;
}) {
  const document = parseReviewContent(content);
  return (
    <div className={cn("space-y-2 whitespace-pre-wrap break-words", className)}>
      {!document?.blocks.length
        ? fallback
        : document.blocks.map((block, index) => {
            const style = { textAlign: block.align };
            if (block.type === "youtube")
              return showMedia ? (
                <ReviewVideo key={index} url={block.url} locale={locale} />
              ) : null;
            if ("items" in block) {
              const List = block.type === "bulletList" ? "ul" : "ol";
              return (
                <List
                  key={index}
                  style={style}
                  className={cn(
                    "pl-5",
                    List === "ul" ? "list-disc" : "list-decimal",
                  )}
                >
                  {block.items.map((item, i) => (
                    <li key={i}>{spans(item, showLinks)}</li>
                  ))}
                </List>
              );
            }
            if (block.type === "heading")
              return (
                <h3
                  key={index}
                  style={style}
                  className="font-display text-lg font-semibold"
                >
                  {spans(block.children, showLinks)}
                </h3>
              );
            return (
              <p key={index} style={style}>
                {spans(block.children, showLinks)}
              </p>
            );
          })}
    </div>
  );
}
