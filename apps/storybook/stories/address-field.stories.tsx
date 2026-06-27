import { AddressField, type AddressProvider, type StoreAddress } from "@loyalty/ui";
import { useState } from "react";

const meta = {
  title: "Components/AddressField",
  component: AddressField,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Structured address capture: controlled/uncontrolled, RHF-friendly (value/onChange carry one `StoreAddress | null`). Typing searches through an injected `AddressProvider` (swap Google for an own service); selecting opens a confirm modal with the structured fields + a draggable pin. Without a provider it's manual-entry only. The stories use a mock provider — no Google key needed.",
      },
    },
  },
};

export default meta;

/** Mock backend so the story works offline (no Google key). */
const mockProvider: AddressProvider = {
  async search(query) {
    if (!query.trim()) return [];
    return [
      { id: "1", primary: "Cra 13 #85-32", secondary: "Bogotá, Colombia", description: "Cra 13 #85-32, Bogotá" },
      { id: "2", primary: "Cl. 85 #11-20", secondary: "Bogotá, Colombia", description: "Cl. 85 #11-20, Bogotá" },
    ];
  },
  async getDetails(id) {
    const base: StoreAddress = {
      line1: id === "1" ? "Cra 13 #85-32" : "Cl. 85 #11-20",
      city: "Bogotá",
      state: "Bogotá D.C.",
      country: "Colombia",
      countryCode: "CO",
      lat: 4.6713,
      lng: -74.0524,
      placeId: id,
      formatted: id === "1" ? "Cra 13 #85-32, Bogotá" : "Cl. 85 #11-20, Bogotá",
    };
    return base;
  },
};

export const WithProvider = {
  render: () => {
    const [value, setValue] = useState<StoreAddress | null>(null);
    return (
      <div className="max-w-md space-y-3">
        <AddressField value={value} onChange={setValue} provider={mockProvider} />
        <pre className="bg-muted rounded-lg p-3 text-xs">{JSON.stringify(value, null, 2)}</pre>
      </div>
    );
  },
};

export const ManualOnly = {
  render: () => {
    const [value, setValue] = useState<StoreAddress | null>(null);
    return (
      <div className="max-w-md space-y-3">
        <AddressField value={value} onChange={setValue} />
        <pre className="bg-muted rounded-lg p-3 text-xs">{JSON.stringify(value, null, 2)}</pre>
      </div>
    );
  },
};

export const Prefilled = {
  render: () => {
    const [value, setValue] = useState<StoreAddress | null>({
      line1: "Cra 13 #85-32",
      line2: "Local 2",
      city: "Bogotá",
      country: "Colombia",
      countryCode: "CO",
      lat: 4.6713,
      lng: -74.0524,
      formatted: "Cra 13 #85-32, Local 2, Bogotá, Colombia",
    });
    return (
      <div className="max-w-md">
        <AddressField value={value} onChange={setValue} provider={mockProvider} />
      </div>
    );
  },
};
