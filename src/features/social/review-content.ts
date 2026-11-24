import { z } from "zod";

export function reviewVideoId(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const id =
      host === "youtu.be"
        ? url.pathname.slice(1)
        : host === "youtube.com" || host === "m.youtube.com"
          ? url.pathname.startsWith("/shorts/")
            ? url.pathname.slice(8)
            : url.searchParams.get("v")
          : null;
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

const align = z.enum(["left", "center", "right", "justify"]).optional();
const link = z
  .string()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  });
const inline = z.object({
  text: z.string().max(10000),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  href: link.optional(),
});
const inlines = z.array(inline).max(500);
const reviewContentSchema = z.object({
  blocks: z
    .array(
      z.union([
        z.object({
          type: z.enum(["paragraph", "heading"]),
          align,
          children: inlines,
        }),
        z.object({
          type: z.enum(["bulletList", "orderedList"]),
          align,
          items: z.array(inlines).max(100),
        }),
        z.object({
          type: z.literal("youtube"),
          url: z
            .string()
            .max(2048)
            .refine((value) => !!reviewVideoId(value)),
          align,
        }),
      ]),
    )
    .max(100),
});

export type ReviewContent = z.infer<typeof reviewContentSchema>;
export type ReviewInline = z.infer<typeof inline>;

export function parseReviewContent(value: unknown): ReviewContent | null {
  const parsed = reviewContentSchema.safeParse(value);
  if (!parsed.success) return null;
  if (
    new TextEncoder().encode(JSON.stringify(parsed.data)).length > 90000 ||
    Array.from(reviewPlainText(parsed.data)).length > 10000 ||
    parsed.data.blocks.filter((block) => block.type === "youtube").length > 1
  )
    return null;
  return parsed.data;
}

export function reviewPlainText(content: ReviewContent): string {
  const line = (values: ReviewInline[]) =>
    values.map((value) => value.text).join("");
  return content.blocks
    .flatMap((block) => {
      if ("children" in block) return [line(block.children)];
      if ("items" in block) return block.items.map(line);
      return [];
    })
    .join("\n")
    .trim();
}

export function reviewYoutubeId(content: unknown): string | null {
  const block = parseReviewContent(content)?.blocks.find(
    (value) => value.type === "youtube",
  );
  return block?.type === "youtube" ? reviewVideoId(block.url) : null;
}
