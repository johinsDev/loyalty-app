"use client";

import { type Editor, Extension, Node, mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import {
  Bold,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Redo2,
  Smile,
  Strikethrough,
  Undo2,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";

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

  // Serialize to the raw token in `getText()` (plain-text channels).
  renderText({ node }) {
    return String(node.attrs.token);
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

/** An item in the `{{` autocomplete menu: a ready variable or an entity kind. */
type SuggestItem =
  | { type: "var"; token: string; label: string }
  | { type: "entity"; scope: string; label: string };

/**
 * Generic `{{`-triggered suggestion extension. Typing `{{` opens a menu built
 * from the editor's variables + entity kinds; the app supplies the item list,
 * the insertion command, and the async entity picker via `configure()`.
 */
const VariableSuggestion = Extension.create<{
  suggestion: Omit<SuggestionOptions<SuggestItem, SuggestItem>, "editor">;
}>({
  name: "variableSuggestion",
  addOptions() {
    return { suggestion: { char: "{{" } as never };
  },
  addProseMirrorPlugins() {
    return [Suggestion({ editor: this.editor, ...this.options.suggestion })];
  },
});

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Plain-text (with `{{tokens}}`) → HTML the editor can load, wrapping each token
 * in a variable-chip span so it round-trips. Used by the `plain` channels whose
 * stored value is text, not HTML.
 */
function plainToHtml(text: string, variables?: EditorVariable[]): string {
  if (!text) return "";
  const labelOf = (token: string) =>
    variables?.find((v) => v.token === token)?.label ??
    token.replace(/^\{\{|\}\}$/g, "");
  const re = /\{\{[^}]+\}\}/g;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out += escapeHtml(text.slice(last, m.index));
    const token = m[0];
    out += `<span data-variable data-token="${escapeHtml(token)}" data-label="${escapeHtml(labelOf(token))}">${escapeHtml(token)}</span>`;
    last = m.index + token.length;
  }
  out += escapeHtml(text.slice(last));
  return `<p>${out.replace(/\n/g, "<br>")}</p>`;
}

const insertVariableChip = (editor: Editor, token: string, label: string) =>
  editor
    .chain()
    .focus()
    .insertContent([
      { type: "variable", attrs: { token, label } },
      { type: "text", text: " " },
    ])
    .run();

/**
 * Builds the `{{` suggestion config from live refs. Items = matching variables
 * first, then entity kinds (which open the app's search modal on select).
 * Renders a plain-DOM menu positioned at the caret (no extra popup lib).
 */
function buildVariableSuggestion(refs: {
  variablesRef: RefObject<EditorVariable[] | undefined>;
  entitiesRef: RefObject<{ scope: string; label: string }[] | undefined>;
  onRequestEntityRef: RefObject<
    | ((scope: string, field?: "name" | "href") => Promise<EditorVariable | null>)
    | undefined
  >;
}): Omit<SuggestionOptions<SuggestItem, SuggestItem>, "editor"> {
  const { variablesRef, entitiesRef, onRequestEntityRef } = refs;
  return {
    char: "{{",
    allowedPrefixes: null,
    startOfLine: false,
    items: ({ query }) => {
      const q = query.toLowerCase();
      const vars: SuggestItem[] = (variablesRef.current ?? [])
        .filter(
          (v) =>
            !q ||
            v.label.toLowerCase().includes(q) ||
            v.token.toLowerCase().includes(q),
        )
        .map((v) => ({ type: "var", token: v.token, label: v.label }));
      const ents: SuggestItem[] = (entitiesRef.current ?? [])
        .filter((e) => !q || e.label.toLowerCase().includes(q))
        .map((e) => ({ type: "entity", scope: e.scope, label: e.label }));
      return [...vars, ...ents];
    },
    command: ({ editor, range, props }) => {
      editor.chain().focus().deleteRange(range).run();
      if (props.type === "var") {
        insertVariableChip(editor, props.token, props.label);
      } else {
        const req = onRequestEntityRef.current;
        if (req)
          void req(props.scope).then((v) => {
            if (v) insertVariableChip(editor, v.token, v.label);
          });
      }
    },
    render: () => {
      let root: HTMLDivElement | null = null;
      let items: SuggestItem[] = [];
      let run: (item: SuggestItem) => void = () => {};
      let getRect: (() => DOMRect | null) | null | undefined;
      let active = 0;

      const position = () => {
        if (!root || !getRect) return;
        const rect = getRect();
        if (!rect) return;
        const maxLeft = window.innerWidth - root.offsetWidth - 8;
        root.style.top = `${rect.bottom + 6}px`;
        root.style.left = `${Math.min(rect.left, Math.max(8, maxLeft))}px`;
      };
      const paint = () => {
        if (!root) return;
        root.replaceChildren();
        if (items.length === 0) {
          root.style.display = "none";
          return;
        }
        root.style.display = "block";
        items.forEach((it, i) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = cn(
            "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-sm",
            i === active
              ? "bg-accent text-accent-foreground"
              : "text-foreground hover:bg-muted",
          );
          const label = document.createElement("span");
          label.className = "truncate font-medium";
          label.textContent = it.label;
          const hint = document.createElement("span");
          hint.className = "text-muted-foreground shrink-0 text-[11px]";
          hint.textContent = it.type === "var" ? it.token : "Buscar…";
          btn.append(label, hint);
          btn.addEventListener("mousedown", (e) => {
            e.preventDefault();
            run(it);
          });
          root?.appendChild(btn);
        });
        position();
      };
      return {
        onStart: (props) => {
          items = props.items;
          run = props.command;
          getRect = props.clientRect;
          active = 0;
          root = document.createElement("div");
          root.className =
            "bg-popover border-border fixed z-50 max-h-64 w-56 overflow-auto rounded-xl border p-1 shadow-lg";
          document.body.appendChild(root);
          paint();
        },
        onUpdate: (props) => {
          items = props.items;
          run = props.command;
          getRect = props.clientRect;
          if (active >= items.length) active = 0;
          paint();
        },
        onKeyDown: ({ event }) => {
          if (!root || items.length === 0) return false;
          if (event.key === "ArrowDown") {
            active = (active + 1) % items.length;
            paint();
            return true;
          }
          if (event.key === "ArrowUp") {
            active = (active - 1 + items.length) % items.length;
            paint();
            return true;
          }
          if (event.key === "Enter") {
            const it = items[active];
            if (it) run(it);
            return true;
          }
          if (event.key === "Escape") {
            root.remove();
            root = null;
            return true;
          }
          return false;
        },
        onExit: () => {
          root?.remove();
          root = null;
        },
      };
    },
  };
}

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
  /**
   * Asks the app to pick an entity. `field` selects what token to return:
   * `"name"` (default) → a name chip; `"href"` → the entity's tracked link,
   * used as a link destination in the link popover.
   */
  onRequestEntity?: (
    scope: string,
    field?: "name" | "href",
  ) => Promise<EditorVariable | null>;
  /**
   * Optional image uploader. When provided, the image button offers a
   * click-to-upload zone (with a loading state) that stores the file via the
   * app's storage integration and inserts the returned URL. Keeps the storage
   * hooks out of this generic component. URL-paste stays as a fallback.
   */
  onUploadImage?: (file: File) => Promise<string | null>;
  /**
   * Plain-text mode for channels that don't support rich HTML (SMS/push/
   * WhatsApp). Hides formatting/link/image tools (keeps emoji + variables +
   * `{{`), and emits/loads plain text (with `{{tokens}}`) instead of HTML.
   */
  plain?: boolean;
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
  onUploadImage,
  plain = false,
}: RichTextEditorProps) {
  // Refs keep the `{{`-suggestion (built once for the editor) reading current
  // props, since the extension array is only evaluated on mount.
  const variablesRef = useRef(variables);
  const entitiesRef = useRef(entities);
  const onRequestEntityRef = useRef(onRequestEntity);
  variablesRef.current = variables;
  entitiesRef.current = entities;
  onRequestEntityRef.current = onRequestEntity;

  // Plain channels store text; serialize/parse via `{{tokens}}`.
  const readValue = (ed: Editor) =>
    plain ? ed.getText({ blockSeparator: "\n" }) : ed.getHTML();

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      plain
        ? StarterKit.configure({
            heading: false,
            bold: false,
            italic: false,
            strike: false,
            code: false,
            bulletList: false,
            orderedList: false,
            listItem: false,
            blockquote: false,
            codeBlock: false,
            horizontalRule: false,
          })
        : StarterKit.configure({ heading: { levels: [2, 3] } }),
      // Link/Image only in rich mode.
      ...(plain
        ? []
        : [
            // `inclusive: false` so typing after a link doesn't keep extending it.
            Link.extend({ inclusive: false }).configure({ openOnClick: false }),
            Image.configure({ inline: false }),
          ]),
      Variable,
      VariableSuggestion.configure({
        suggestion: buildVariableSuggestion({
          variablesRef,
          entitiesRef,
          onRequestEntityRef,
        }),
      }),
    ],
    content: plain ? plainToHtml(value, variables) : value,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none min-h-32 px-4 py-3 outline-none",
          "[&_a]:text-primary [&_a]:underline",
        ),
        ...(placeholder ? { "data-placeholder": placeholder } : {}),
      },
    },
    onUpdate: ({ editor }) => onValueChange?.(readValue(editor)),
  });

  // Sync external value changes (e.g. resetting the form) without clobbering
  // the cursor while typing.
  useEffect(() => {
    if (editor && value !== readValue(editor)) {
      editor.commands.setContent(plain ? plainToHtml(value, variables) : value, {
        emitUpdate: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, value]);

  const [linkPop, setLinkPop] = useState(false);
  const [imgPop, setImgPop] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [imgUrl, setImgUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const linkToEntity = async (scope: string) => {
    if (!onRequestEntity) return;
    const v = await onRequestEntity(scope, "href");
    if (!v) return;
    if (editor.state.selection.empty) {
      // No selection: drop the entity name in as the linked text.
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: v.label,
          marks: [{ type: "link", attrs: { href: v.token } }],
        })
        .insertContent(" ")
        .run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: v.token }).run();
    }
    setLinkPop(false);
  };
  const insertImage = () => {
    const url = imgUrl.trim();
    if (url) editor.chain().focus().setImage({ src: url }).run();
    setImgUrl("");
    setImgPop(false);
  };
  const uploadImageFile = async (file: File | undefined) => {
    if (!file || !onUploadImage) return;
    setUploading(true);
    try {
      const url = await onUploadImage(file);
      if (url) editor.chain().focus().setImage({ src: url }).run();
      setImgPop(false);
    } finally {
      setUploading(false);
    }
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
        {plain ? null : (
          <>
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
            {onRequestEntity && entities && entities.length > 0 ? (
              <>
                <div className="text-muted-foreground flex items-center gap-2 text-[11px]">
                  <span className="bg-border h-px flex-1" />o enlaza a
                  <span className="bg-border h-px flex-1" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {entities.map((e) => (
                    <button
                      key={e.scope}
                      type="button"
                      onClick={() => void linkToEntity(e.scope)}
                      className="border-border text-muted-foreground hover:bg-muted rounded-full border border-dashed px-2 py-0.5 text-xs font-semibold transition-colors"
                    >
                      + {e.label}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </PopoverContent>
        </Popover>

        <Popover open={imgPop} onOpenChange={setImgPop}>
          <PopoverTrigger className={triggerClass()} title="Imagen / GIF">
            <ImagePlus className="size-4" />
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-2.5 p-2.5">
            {onUploadImage ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    void uploadImageFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-input text-muted-foreground hover:border-ring hover:bg-muted/50 flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-xs font-medium transition-colors disabled:opacity-70"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="size-5 animate-spin" />
                      Subiendo…
                    </>
                  ) : (
                    <>
                      <Upload className="size-5" />
                      Subir imagen o GIF
                    </>
                  )}
                </button>
                <div className="text-muted-foreground flex items-center gap-2 text-[11px]">
                  <span className="bg-border h-px flex-1" />o pega un enlace
                  <span className="bg-border h-px flex-1" />
                </div>
              </>
            ) : null}
            <div className="flex gap-1.5">
              <input
                value={imgUrl}
                onChange={(e) => setImgUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && insertImage()}
                placeholder="https://…/imagen.png"
                className="border-input h-9 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none"
              />
              <button
                type="button"
                onClick={insertImage}
                className="bg-primary text-primary-foreground h-9 shrink-0 rounded-lg px-3 text-xs font-semibold"
              >
                Insertar
              </button>
            </div>
          </PopoverContent>
        </Popover>
          </>
        )}

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
