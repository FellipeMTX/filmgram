"use client";

import { useState } from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import {
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link as LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reviewVideoId } from "./review-content";

type Inline = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  href?: string;
};
type Block =
  | { type: "paragraph" | "heading"; children: Inline[]; align?: string }
  | { type: "bulletList" | "orderedList"; items: Inline[][]; align?: string }
  | { type: "youtube"; url: string };
type Document = { blocks: Block[] };
const labels = {
  en: {
    bold: "Bold",
    italic: "Italic",
    left: "Align left",
    center: "Align center",
    right: "Align right",
    justify: "Justify",
    link: "Add link",
    url: "Link URL",
    apply: "Apply",
    cancel: "Cancel",
    editor: "Write a review",
    invalid: "Enter a valid http or https URL.",
    videoHint: "Paste a YouTube link on its own line to add a video.",
  },
  "pt-BR": {
    bold: "Negrito",
    italic: "Itálico",
    left: "Alinhar à esquerda",
    center: "Centralizar",
    right: "Alinhar à direita",
    justify: "Justificar",
    link: "Adicionar link",
    url: "URL do link",
    apply: "Aplicar",
    cancel: "Cancelar",
    editor: "Escreva uma resenha",
    invalid: "Informe uma URL http ou https válida.",
    videoHint:
      "Cole um link do YouTube em uma linha separada para adicionar um vídeo.",
  },
  es: {
    bold: "Negrita",
    italic: "Cursiva",
    left: "Alinear a la izquierda",
    center: "Centrar",
    right: "Alinear a la derecha",
    justify: "Justificar",
    link: "Añadir enlace",
    url: "URL del enlace",
    apply: "Aplicar",
    cancel: "Cancelar",
    editor: "Escribe una reseña",
    invalid: "Introduce una URL http o https válida.",
    videoHint:
      "Pega un enlace de YouTube en una línea separada para añadir un vídeo.",
  },
};

function inline(nodes: JSONContent[] = []): Inline[] {
  return nodes.flatMap((node) =>
    node.type === "text" && node.text
      ? [
          {
            text: node.text,
            ...(node.marks?.some((m) => m.type === "bold")
              ? { bold: true }
              : {}),
            ...(node.marks?.some((m) => m.type === "italic")
              ? { italic: true }
              : {}),
            ...(node.marks?.some((m) => m.type === "underline")
              ? { underline: true }
              : {}),
            ...(node.marks?.find((m) => m.type === "link")?.attrs?.href
              ? {
                  href: String(
                    node.marks.find((m) => m.type === "link")!.attrs!.href,
                  ),
                }
              : {}),
          },
        ]
      : node.type === "hardBreak"
        ? [{ text: "\n" }]
        : [],
  );
}
function serialize(json: JSONContent): Document {
  const blocks: Block[] = [];
  for (const node of json.content || []) {
    if (node.type === "paragraph" || node.type === "heading") {
      const children = inline(node.content);
      const text = children
        .map((c) => c.text)
        .join("")
        .trim();
      if (reviewVideoId(text)) blocks.push({ type: "youtube", url: text });
      else
        blocks.push({
          type: node.type,
          children,
          ...(node.attrs?.textAlign ? { align: node.attrs.textAlign } : {}),
        });
    } else if (node.type === "bulletList" || node.type === "orderedList") {
      blocks.push({
        type: node.type,
        items: flattenList(node),
      });
    }
  }
  return { blocks };
}
function flattenList(list: JSONContent): Inline[][] {
  return (list.content || []).flatMap((item) => {
    const paragraphs = (item.content || []).filter(
      (node) => node.type === "paragraph" || node.type === "heading",
    );
    const nested = (item.content || []).filter(
      (node) => node.type === "bulletList" || node.type === "orderedList",
    );
    return [
      paragraphs.flatMap((p, index) => [
        ...(index > 0 ? [{ text: "\n" }] : []),
        ...inline(p.content),
      ]),
      ...nested.flatMap(flattenList),
    ];
  });
}
function textNodes(children: Inline[]): JSONContent[] {
  return children.flatMap((part) =>
    part.text
      ? [
          {
            type: "text",
            text: part.text,
            marks: [
              ...(part.bold ? [{ type: "bold" }] : []),
              ...(part.italic ? [{ type: "italic" }] : []),
              ...(part.underline ? [{ type: "underline" }] : []),
              ...(part.href
                ? [{ type: "link", attrs: { href: part.href } }]
                : []),
            ],
          },
        ]
      : [],
  );
}
function initialContent(
  document: Document | null | undefined,
  body: string,
  video: string | null,
): JSONContent {
  if (document?.blocks?.length)
    return {
      type: "doc",
      content: document.blocks.map((block) => {
        if (block.type === "youtube")
          return {
            type: "paragraph",
            content: [{ type: "text", text: block.url }],
          };
        if (block.type === "bulletList" || block.type === "orderedList")
          return {
            type: block.type,
            content: block.items.map((item) => ({
              type: "listItem",
              content: [{ type: "paragraph", content: textNodes(item) }],
            })),
          };
        return {
          type: block.type,
          attrs: {
            textAlign: block.align || "left",
            ...(block.type === "heading" ? { level: 3 } : {}),
          },
          content: textNodes("children" in block ? block.children : []),
        };
      }),
    };
  const lines = body ? body.split("\n") : [""];
  if (video) lines.push(`https://www.youtube.com/watch?v=${video}`);
  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      ...(line ? { content: [{ type: "text", text: line }] } : {}),
    })),
  };
}

export function RichReviewEditor({
  locale,
  body,
  document,
  video,
  onChange,
}: {
  locale: string;
  body: string;
  document?: Document | null;
  video: string | null;
  onChange: (value: Document) => void;
}) {
  const l = labels[locale as keyof typeof labels] || labels.en;
  const [linking, setLinking] = useState(false),
    [url, setUrl] = useState(""),
    [invalid, setInvalid] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        code: false,
        link: {
          openOnClick: false,
          isAllowedUri: (value) => {
            try {
              const parsed = new URL(value);
              return (
                ["http:", "https:"].includes(parsed.protocol) &&
                !parsed.username &&
                !parsed.password
              );
            } catch {
              return false;
            }
          },
        },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: initialContent(document, body, video),
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": l.editor,
        "aria-multiline": "true",
        class:
          "min-h-28 w-full rounded-b-md border border-t-0 border-input bg-background p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-pre-wrap",
      },
    },
    onUpdate: ({ editor }) => onChange(serialize(editor.getJSON())),
    onCreate: ({ editor }) => onChange(serialize(editor.getJSON())),
  });
  if (!editor) return null;
  const controls = [
    {
      label: l.bold,
      icon: Bold,
      active: editor.isActive("bold"),
      action: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: l.italic,
      icon: Italic,
      active: editor.isActive("italic"),
      action: () => editor.chain().focus().toggleItalic().run(),
    },
    ...(
      [
        ["left", AlignLeft, l.left],
        ["center", AlignCenter, l.center],
        ["right", AlignRight, l.right],
        ["justify", AlignJustify, l.justify],
      ] as const
    ).map(([alignment, icon, label]) => ({
      label,
      icon,
      active: editor.isActive({ textAlign: alignment }),
      action: () => editor.chain().focus().setTextAlign(alignment).run(),
    })),
  ];
  return (
    <div>
      <div
        role="toolbar"
        aria-label={l.editor}
        className="flex flex-wrap gap-1 rounded-t-md border border-input bg-muted/30 p-1"
      >
        {controls.map(({ label, icon: Icon, active, action }) => (
          <Button
            key={label}
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={label}
            aria-pressed={active}
            onMouseDown={(e) => e.preventDefault()}
            onClick={action}
          >
            <Icon size={16} />
          </Button>
        ))}
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={l.link}
          aria-pressed={editor.isActive("link")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setUrl(editor.getAttributes("link").href || "");
            setLinking(true);
          }}
        >
          <LinkIcon size={16} />
        </Button>
      </div>
      <EditorContent editor={editor} />
      <p className="mt-1 text-xs text-muted-foreground">{l.videoHint}</p>
      {linking && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 text-sm">
            {l.url}
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              try {
                const parsed = new URL(url);
                if (
                  !["http:", "https:"].includes(parsed.protocol) ||
                  parsed.username ||
                  parsed.password
                )
                  throw new Error();
                editor
                  .chain()
                  .focus()
                  .extendMarkRange("link")
                  .setLink({ href: parsed.href })
                  .run();
                setLinking(false);
                setInvalid(false);
              } catch {
                setInvalid(true);
              }
            }}
          >
            {l.apply}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setLinking(false)}
          >
            {l.cancel}
          </Button>
          {invalid && (
            <p role="alert" className="w-full text-sm text-destructive">
              {l.invalid}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
export { initialContent, serialize };
