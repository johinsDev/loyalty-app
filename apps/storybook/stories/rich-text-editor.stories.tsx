import { Label, RichTextEditor } from "@loyalty/ui";
import { useState } from "react";

const meta = {
  title: "Components/RichTextEditor",
  component: RichTextEditor,
  tags: ["autodocs"],
};
export default meta;

/** Minimal tiptap editor (bold/italic/strike/lists/link/undo). Emits HTML. */
export const Default = {
  render: () => {
    const [html, setHtml] = useState("<p>Describe tu producto…</p>");
    return (
      <div className="flex w-[32rem] flex-col gap-1.5">
        <Label>Descripción</Label>
        <RichTextEditor value={html} onValueChange={setHtml} />
        <pre className="text-muted-foreground mt-2 text-xs whitespace-pre-wrap">
          {html}
        </pre>
      </div>
    );
  },
};
