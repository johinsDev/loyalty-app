import { AddressAutocomplete } from "@loyalty/ui/components/ui/address-autocomplete";
import { useState } from "react";

const meta = {
  title: "Components/AddressAutocomplete",
  component: AddressAutocomplete,
  tags: ["autodocs"],
};
export default meta;

export const Default = {
  render: () => {
    const [value, setValue] = useState("");
    return (
      <div className="flex w-80 flex-col gap-2">
        <AddressAutocomplete
          value={value}
          onValueChange={setValue}
          placeholder="Enter an address"
        />
        <p className="text-xs text-muted-foreground">
          Fallback mode: behaves as a plain text input. Set
          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (or pass an apiKey) to enable Google
          Places autocomplete.
        </p>
      </div>
    );
  },
};
