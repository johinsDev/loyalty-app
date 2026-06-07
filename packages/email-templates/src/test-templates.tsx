import { renderEmail } from "./render";
import { WelcomeEmail } from "./templates/welcome-email";

/**
 * Templates the admin `/email-outbox` dev tool can send as a one-off
 * "test email". Each entry pairs a stable `id` (shipped in the
 * Trigger.dev payload) with a default subject; the body renders from the
 * template's own `PreviewProps`, so an operator picks a template and
 * sends without typing anything.
 *
 * `welcome` is the only template today — add a case to
 * `renderTestEmailTemplate` when a new template ships.
 */
export const TEST_EMAIL_TEMPLATES = [
  { id: "welcome", subject: "¡Bienvenida a T4! 🍵" },
] as const;

export type TestEmailTemplateId = (typeof TEST_EMAIL_TEMPLATES)[number]["id"];

export const TEST_EMAIL_TEMPLATE_IDS = TEST_EMAIL_TEMPLATES.map((t) => t.id) as [
  TestEmailTemplateId,
  ...TestEmailTemplateId[],
];

/**
 * Render a known template to `{ subject, html, text }` using its sample
 * props. Keeps all JSX/React inside this package so callers (the jobs
 * task, which is plain TypeScript) never depend on `react` directly.
 */
export async function renderTestEmailTemplate(
  id: TestEmailTemplateId,
): Promise<{ subject: string; html: string; text: string }> {
  switch (id) {
    case "welcome": {
      const element = <WelcomeEmail {...WelcomeEmail.PreviewProps} />;
      const [html, text] = await Promise.all([
        renderEmail(element),
        renderEmail(element, { plainText: true }),
      ]);
      return { subject: "¡Bienvenida a T4! 🍵", html, text };
    }
  }
  throw new Error(`Unknown test email template: ${id satisfies never}`);
}
