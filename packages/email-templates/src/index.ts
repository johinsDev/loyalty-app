// Public API of @loyalty/email-templates.
//
// Importers (apps/web, apps/admin, packages/jobs) do:
//
//   import { renderEmail, WelcomeEmail } from "@loyalty/email-templates";
//   const html = await renderEmail(<WelcomeEmail name="..." ctaUrl="..." />);
//
// See .claude/skills/email/SKILL.md and .claude/skills/react-email/SKILL.md
// for the full handbook.

export { EmailLayout } from "./components/email-layout";
export { renderEmail } from "./render";
export {
  TEST_EMAIL_TEMPLATE_IDS,
  TEST_EMAIL_TEMPLATES,
  renderTestEmailTemplate,
  type TestEmailTemplateId,
} from "./test-templates";
export { WelcomeEmail, type WelcomeEmailProps } from "./templates/welcome-email";
