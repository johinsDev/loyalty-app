"use client";

import { createContext, type ReactNode, useContext, useMemo, useState } from "react";

import { CommandPalette } from "@/components/command-palette";

/**
 * Client transport for the ⌘K command palette. Mounted once in {@link AdminShell}
 * so both the server-rendered nav hole (desktop rail + mobile drawer, whose search
 * button can't receive a function prop across the server boundary) and any other
 * client island can open the palette via `useCommandPalette().open()`. The palette
 * instance + its open state live here; the keyboard shortcut is bound inside
 * `CommandPalette`.
 */
interface CommandPaletteValue {
  open: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteValue | null>(null);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const value = useMemo<CommandPaletteValue>(() => ({ open: () => setIsOpen(true) }), []);
  return (
    <CommandPaletteContext.Provider value={value}>
      <CommandPalette open={isOpen} onOpenChange={setIsOpen} />
      {children}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette(): CommandPaletteValue {
  return useContext(CommandPaletteContext) ?? { open: () => {} };
}
