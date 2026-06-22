import { UrlInput } from "@loyalty/ui/components/ui/url-input";
import { useState } from "react";

const meta = {
  title: "Components/UrlInput",
  component: UrlInput,
  tags: ["autodocs"],
};
export default meta;

export const Default = {
  render: () => {
    const [value, setValue] = useState("");
    return (
      <div className="w-80">
        <UrlInput value={value} onChange={setValue} placeholder="example.com" />
      </div>
    );
  },
};
