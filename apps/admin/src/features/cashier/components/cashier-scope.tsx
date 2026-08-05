"use client";

import { useEffect } from "react";

/**
 * Puts `cashier-scope` on `<body>` for as long as the register is mounted.
 *
 * The class is already on the segment's own wrapper, which is enough for
 * everything drawn in the page — but dialogs and drawers render through a
 * portal attached to `<body>`, outside that wrapper. So the modals kept the
 * admin's Luma pill while the page behind them had moved to soft rectangles,
 * and the split ran right down the middle of one screen: the picker's "Agregar"
 * was a stadium, the "Registrar compra" behind it was not.
 *
 * Applied from an effect rather than in the RSC because the segment layout
 * doesn't own `<body>`; the class only matters for portals, which can't exist
 * before hydration, so there is nothing to flash.
 */
export function CashierScope() {
  useEffect(() => {
    document.body.classList.add("cashier-scope");
    return () => document.body.classList.remove("cashier-scope");
  }, []);
  return null;
}
