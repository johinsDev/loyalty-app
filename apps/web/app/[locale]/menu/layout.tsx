import type { ReactNode } from "react";

/** Hosts the `@modal` parallel slot so `/product/[slug]` can be intercepted as a
 *  modal over the menu (full page on hard load). */
export default function MenuLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
