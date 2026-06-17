# design-sync notes

- First sync: 2026-06-16. Project "T4 Loyalty" (f45dbdc7-5c42-459f-b5b0-6bdcfc4c2618).
- Scope: SCOPED first sync — only the components the key pilot screens (customer Card, cashier POS-lite, admin) use. Expand to the full ~60-component library in a later sync.
  - Target set: card, progress, badge, avatar, button, table, tabs, dialog, drawer, sheet, input, input-phone, input-otp, calendar, dropzone, tooltip, sonner, command, combobox, select, separator, skeleton, stepper.
- UI library lives in packages/ui (shadcn over Base UI, Tailwind v4 tokens). Default theme today; brand aesthetic (Fraunces display font, purple+green Leaf/coral palette) to be baked into packages/ui tokens in a later pass, then re-synced.

## Round 1 findings (2026-06-16)

- [GENERAL] No global render issues. CSS (Tailwind v4 scraped from sb-reference, 132KB), fonts, tokens and sizing all apply correctly. Verified on Button/Card/Dialog/Avatar (all match).
- [GENERAL] `.storybook/preview.ts` has NO React provider — only a `dark` class toggle (default light). So cfg.provider is NOT needed; previews render light-themed correctly. The build's "preview decorator bundle failed" warning is harmless here.
- [GENERAL] Framing differs between panels: storybook centers + crops tight; the preview page renders the component top-left on a full viewport, so the contact sheet shrinks the preview more. Judge the component, not the size — confirm via raw/ PNGs.
- InputOTP: sb-error (interaction/controlled story doesn't render statically in storybook). Not graded; ships functional in the bundle. Re-sync risk: revisit if input-otp is needed visually.
- Dropzone + Sonner(Toaster): not public component exports in the bundle's PascalCase set (TITLE_UNMAPPED / not matched). Not synced this round. Re-sync risk: add via cfg.titleMap if needed.
- Card stories are already loyalty-themed ("Tu tarjeta · sellos · Ver detalle").

## Promoted [GENERAL] learnings (round 1 fan-out)

- [GENERAL] Arbitrary Tailwind utilities (w-72, size-12, h-4, w-32, …) ARE present in the scraped bundle CSS — nothing collapses to intrinsic size. Apparent shrink in the compare SHEET is framing only; raw/ PNGs show identical absolute pixel sizes.
- [GENERAL] Width/connector-length differences come from framing only (storybook centers + crops tight; previews render top-left on a full viewport). A horizontal-stretch-only delta on an otherwise identical component is a MATCH, not close.
- [GENERAL] Overlay components (Dialog/Drawer/Sheet/Combobox/Command/Tooltip) whose Default story is CLOSED render only their trigger statically; the storybook reference shows the same closed trigger → grade match, no portal bleed, no open-state mirroring or cardMode needed. Only an explicitly-open story would need that.

## Re-sync risks
- Scoped first sync: only 20 components visually graded (Button, Card, Dialog, Avatar, Badge, Progress, Separator, Skeleton, Table, Tabs, Input, InputPhone, Select, Tooltip, Calendar, Combobox, Command, Drawer, Sheet, Stepper). The other ~35 ship functional (passed render-check) but UNVERIFIED against storybook.
- Known render-thin (ship looking empty — fix in next sync with owned previews): Spinner, Toggle, ToggleGroup.
- InputOTP: sb-error, not graded.
- Dropzone, Chart, Resizable, Sonner(Toaster): not in the synced component set (unmapped / not public exports).
