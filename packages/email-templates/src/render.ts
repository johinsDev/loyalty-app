/**
 * Convert a React Email component to an HTML string. Thin re-export
 * so consuming apps don't pull `react-email` as a direct dependency
 * — they import everything via `@loyalty/email-templates`.
 *
 * @example
 *   import { renderEmail, WelcomeEmail } from "@loyalty/email-templates";
 *
 *   const html = await renderEmail(
 *     <WelcomeEmail name="Lucía" ctaUrl="https://t4.app/card" />,
 *   );
 *
 * To produce a plain-text alternative for accessibility, pass
 * `{ plainText: true }`:
 *
 *   const text = await renderEmail(<WelcomeEmail .../>, { plainText: true });
 */
export { render as renderEmail } from "@react-email/render";
