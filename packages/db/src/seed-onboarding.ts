/**
 * Seeds the default onboarding carousel for the primary org — the built-in
 * "welcome to T4 Lovers" template, now as real editable DB rows (es + en) so
 * the admin can tweak it instead of it living only as an app-side fallback.
 * Idempotent: overwrites the org's `onboarding` with the template.
 *
 *   DATABASE_URL='http://localhost:8080' bun run --cwd packages/db src/seed-onboarding.ts
 */
/* eslint-disable no-console */
import { db, getPrimaryOrganizationId } from "./index";
import { type OnboardingStep, organizationSettings } from "./schema";

const org = await getPrimaryOrganizationId();
if (!org) throw new Error("no primary organization");

const TEMPLATE: OnboardingStep[] = [
  {
    id: "welcome",
    icon: "🧋",
    backgroundCss: "linear-gradient(135deg, #1BAD9D, #0e6f64)",
    text: {
      es: {
        title: "Ganá con cada\nbubble tea",
        body: "<p>Sumá sellos en cada compra y canjealos por bebidas gratis.</p>",
      },
      en: {
        title: "Earn with every\nbubble tea",
        body: "<p>Collect stamps on every purchase and redeem them for free drinks.</p>",
      },
    },
  },
  {
    id: "levelup",
    icon: "⭐",
    backgroundCss: "linear-gradient(135deg, #7c5cff, #4527a0)",
    text: {
      es: {
        title: "Subí de nivel\nen T4 Lovers",
        body: "<p>Premios, sorpresas y beneficios solo para la comunidad.</p>",
      },
      en: {
        title: "Level up\nin T4 Lovers",
        body: "<p>Rewards, surprises and perks just for the community.</p>",
      },
    },
  },
  {
    id: "first-stamp",
    icon: "🎁",
    backgroundCss: "linear-gradient(135deg, #f0a868, #e0467c)",
    text: {
      es: {
        title: "Tu primer sello\nva de regalo",
        body: "<p>Arrancás con un sello gratis al unirte. ¡Bienvenido a la comunidad!</p>",
      },
      en: {
        title: "Your first stamp\nis on us",
        body: "<p>Start with a free stamp when you join. Welcome to the community!</p>",
      },
    },
  },
];

await db
  .insert(organizationSettings)
  .values({ organizationId: org, onboarding: TEMPLATE })
  .onConflictDoUpdate({
    target: organizationSettings.organizationId,
    set: { onboarding: TEMPLATE, updatedAt: new Date() },
  });

console.log(`✨ Seeded ${TEMPLATE.length} onboarding steps for org ${org}.`);
process.exit(0);
