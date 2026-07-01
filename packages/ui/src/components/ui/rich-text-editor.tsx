"use client";

import Link from "@tiptap/extension-link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Redo2,
  Strikethrough,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useEffect } from "react";

import { cn } from "../../cn";

export interface RichTextEditorProps {
  /** Controlled HTML value. */
  value?: string;
  onValueChange?: (html: string) => void;
  placeholder?: string;
  className?: string;
  /**
   * Optional merge-variable names. When provided, a pill row is shown that
   * inserts `{{var}}` at the cursor (for campaign templating).
   */
  variables?: string[];
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
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false }),
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

  if (!editor) return null;

  const setLink = () => {
    const url = window.prompt("URL");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  };

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
        <Tool icon={LinkIcon} active={editor.isActive("link")} onClick={setLink} />
        <span className="bg-border mx-1 h-5 w-px" />
        <Tool icon={Undo2} onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} />
        <Tool icon={Redo2} onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} />
      </div>
      {variables && variables.length > 0 ? (
        <div className="border-border flex flex-wrap items-center gap-1.5 border-b px-2 py-1.5">
          {variables.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => editor.chain().focus().insertContent(`{{${v}}}`).run()}
              className="bg-primary/10 text-primary hover:bg-primary/20 rounded-full px-2 py-0.5 font-mono text-xs transition-colors"
            >
              {`{{${v}}}`}
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
