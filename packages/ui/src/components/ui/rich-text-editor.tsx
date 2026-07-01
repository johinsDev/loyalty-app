"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Redo2,
  Smile,
  Strikethrough,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "../../cn";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

/** Common emojis for the quick picker. */
const EMOJIS = [
  "😀", "😍", "🥳", "🤩", "😎", "🙌", "👍", "🔥",
  "🎉", "🎁", "💜", "❤️", "✨", "⭐", "🧋", "☕",
  "🍰", "🛍️", "💸", "🏷️", "⏰", "📣", "✅", "🚀",
];

/** A merge variable the editor can insert as a chip. */
export interface EditorVariable {
  /** The token serialized into the HTML, e.g. `{{user.name}}`. */
  token: string;
  /** The friendly label shown on the chip, e.g. `Nombre`. */
  label: string;
}

/**
 * Inline atom node that shows a friendly chip in the editor but serializes to
 * its `{{token}}` text, so the backend template renderer can substitute it.
 */
const Variable = Node.create({
  name: "variable",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      token: { default: "" },
      label: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-variable]",
        getAttrs: (el) => {
          const node = el as HTMLElement;
          const token = node.getAttribute("data-token") ?? node.textContent ?? "";
          return { token, label: node.getAttribute("data-label") ?? token };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    // The text content is the token so `{{...}}` survives into getHTML() and the
    // send-time renderer replaces it (attributes carry the label for re-parsing).
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-variable": "",
        "data-token": node.attrs.token,
        "data-label": node.attrs.label,
        class: "variable-chip",
      }),
      node.attrs.token,
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("span");
      dom.className =
        "variable-chip bg-primary/10 text-primary rounded px-1 py-0.5 font-mono text-xs";
      dom.textContent = String(node.attrs.label || node.attrs.token);
      dom.setAttribute("title", String(node.attrs.token));
      dom.contentEditable = "false";
      return { dom };
    };
  },
});

export interface RichTextEditorProps {
  /** Controlled HTML value. */
  value?: string;
  onValueChange?: (html: string) => void;
  placeholder?: string;
  className?: string;
  /**
   * Optional merge variables. When provided, a pill row inserts each as a chip
   * (friendly label in the editor, `{{token}}` in the serialized HTML).
   */
  variables?: EditorVariable[];
  /**
   * Optional entity kinds (e.g. `{ scope: "promo", label: "Promoción" }`). The
   * button asks the app (`onRequestEntity`) to pick an entity, then inserts the
   * returned chip. Keeps the app's search modal out of this generic component.
   */
  entities?: { scope: string; label: string }[];
  onRequestEntity?: (scope: string) => Promise<EditorVariable | null>;
}

/**
 * Minimal rich-text editor (tiptap StarterKit + link) with a small toolbar
 * (bold / italic / strike / lists / link / undo-redo). Emits HTML via
 * `onValueChange`. Styled to match our inputs (rounded border, focus ring).
 */
export function RichTextEditor({
  value = "",
  onValueChange,
  placeholder,
  className,
  variables,
  entities,
  onRequestEntity,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      // `inclusive: false` so typing after a link doesn't keep extending it.
      Link.extend({ inclusive: false }).configure({ openOnClick: false }),
      Image.configure({ inline: false }),
      Variable,
    ],
    content: value,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none min-h-32 px-4 py-3 outline-none",
          "[&_a]:text-primary [&_a]:underline",
        ),
        ...(placeholder ? { "data-placeholder": placeholder } : {}),
      },
    },
    onUpdate: ({ editor }) => onValueChange?.(editor.getHTML()),
  });

  // Sync external value changes (e.g. resetting the form) without clobbering
  // the cursor while typing.
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  const [linkPop, setLinkPop] = useState(false);
  const [imgPop, setImgPop] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [imgUrl, setImgUrl] = useState("");

  if (!editor) return null;

  const insertVariable = (v: EditorVariable) =>
    editor
      .chain()
      .focus()
      .insertContent([
        { type: "variable", attrs: { token: v.token, label: v.label } },
        { type: "text", text: " " },
      ])
      .run();

  const pickEntity = async (scope: string) => {
    if (!onRequestEntity) return;
    const v = await onRequestEntity(scope);
    if (v) insertVariable(v);
  };

  const applyLink = () => {
    const url = linkUrl.trim();
    if (!url) editor.chain().focus().unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    setLinkPop(false);
  };
  const insertImage = () => {
    const url = imgUrl.trim();
    if (url) editor.chain().focus().setImage({ src: url }).run();
    setImgUrl("");
    setImgPop(false);
  };

  const triggerClass = (active?: boolean) =>
    cn(
      "grid size-8 place-items-center rounded-md transition-colors",
      active
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  return (
    <div
      className={cn(
        "border-input bg-input/30 focus-within:border-ring focus-within:ring-ring/50 overflow-hidden rounded-xl border focus-within:ring-3",
        className,
      )}
    >
      <div className="border-border flex flex-wrap items-center gap-0.5 border-b p-1.5">
        <Tool icon={Bold} active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} />
        <Tool icon={Italic} active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <Tool icon={Strikethrough} active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} />
        <span className="bg-border mx-1 h-5 w-px" />
        <Tool icon={List} active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <Tool icon={ListOrdered} active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} />

        <Popover
          open={linkPop}
          onOpenChange={(o) => {
            setLinkPop(o);
            if (o) setLinkUrl((editor.getAttributes("link").href as string) ?? "");
          }}
        >
          <PopoverTrigger className={triggerClass(editor.isActive("link"))} title="Enlace">
            <LinkIcon className="size-4" />
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-2 p-2">
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyLink()}
              placeholder="https://…"
              className="border-input h-9 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().unsetLink().run();
                  setLinkPop(false);
                }}
                className="text-muted-foreground hover:text-foreground h-8 rounded-lg px-2 text-xs font-semibold"
              >
                Quitar
              </button>
              <button
                type="button"
                onClick={applyLink}
                className="bg-primary text-primary-foreground h-8 rounded-lg px-3 text-xs font-semibold"
              >
                Aplicar
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={imgPop} onOpenChange={setImgPop}>
          <PopoverTrigger className={triggerClass()} title="Imagen / GIF">
            <ImagePlus className="size-4" />
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-2 p-2">
            <input
              value={imgUrl}
              onChange={(e) => setImgUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && insertImage()}
              placeholder="https://…/imagen.png · .gif"
              className="border-input h-9 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={insertImage}
                className="bg-primary text-primary-foreground h-8 rounded-lg px-3 text-xs font-semibold"
              >
                Insertar
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger className={triggerClass()} title="Emoji">
            <Smile className="size-4" />
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2">
            <div className="grid grid-cols-8 gap-0.5">
              {EMOJIS.map((emo) => (
                <button
                  key={emo}
                  type="button"
                  onClick={() => editor.chain().focus().insertContent(emo).run()}
                  className="hover:bg-muted grid size-7 place-items-center rounded text-lg"
                >
                  {emo}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <span className="bg-border mx-1 h-5 w-px" />
        <Tool icon={Undo2} onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} />
        <Tool icon={Redo2} onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} />
      </div>
      {(variables && variables.length > 0) || (entities && entities.length > 0) ? (
        <div className="border-border flex flex-wrap items-center gap-1.5 border-b px-2 py-1.5">
          {variables?.map((v) => (
            <button
              key={v.token}
              type="button"
              onClick={() => insertVariable(v)}
              className="bg-primary/10 text-primary hover:bg-primary/20 rounded-full px-2 py-0.5 text-xs font-semibold transition-colors"
            >
              {v.label}
            </button>
          ))}
          {entities?.map((e) => (
            <button
              key={e.scope}
              type="button"
              onClick={() => void pickEntity(e.scope)}
              className="border-border text-muted-foreground hover:bg-muted rounded-full border border-dashed px-2 py-0.5 text-xs font-semibold transition-colors"
            >
              + {e.label}
            </button>
          ))}
        </div>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
}

function Tool({
  icon: Icon,
  active,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "grid size-8 place-items-center rounded-md transition-colors disabled:opacity-40",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}
