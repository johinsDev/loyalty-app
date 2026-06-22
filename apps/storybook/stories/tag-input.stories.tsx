import { Label } from "@loyalty/ui";
import { type Tag, TagInput } from "@loyalty/ui/components/ui/tag-input";
import { useState } from "react";

const meta = {
  title: "Components/TagInput",
  component: TagInput,
  tags: ["autodocs"],
};
export default meta;

/** Default: controlled tag input seeded with a few interests. */
export const Default = {
  render: () => {
    const [tags, setTags] = useState<Tag[]>([
      { id: "1", text: "Sport" },
      { id: "2", text: "Coding" },
      { id: "3", text: "Travel" },
    ]);
    return (
      <div className="flex w-72 flex-col gap-2">
        <Label htmlFor="interests">Interests</Label>
        <TagInput id="interests" value={tags} onChange={setTags} placeholder="Add an interest" />
      </div>
    );
  },
};
