// One-shot seed for the whatsapp_outbox table. Inserts varied test rows
// so the dev view at /[locale]/whatsapp-outbox has data to render.
//
// Run from the repo root:
//   bun --env-file=.env scripts/seed-whatsapp-outbox.ts

import { db } from "@loyalty/db";
import { whatsappOutbox } from "@loyalty/db/schema";

const now = Date.now();
const ago = (mins: number) => new Date(now - mins * 60_000);

type Sample = {
  to: string;
  content: string;
  status: "sent" | "failed";
  sentAt: Date;
  contentSid?: string;
  contentVariables?: Record<string, string>;
  metadata?: Record<string, unknown>;
};

const samples: Sample[] = [
  {
    to: "+5491155555501",
    content: "🔒 *847291* es tu código de verificación para Loyalty. Expira en 5 minutos.",
    status: "sent",
    sentAt: ago(1),
  },
  {
    to: "+5491166778899",
    content: "🎉 ¡Feliz cumpleaños, *Lucía*! Tenés 2 sellos de regalo en tu tarjeta de T4.",
    status: "sent",
    sentAt: ago(8),
  },
  {
    to: "+5491144332211",
    content: "🍵 Hola *Pedro*, sumaste 1 sello. Te faltan 3 para tu próximo Matcha de cortesía.",
    status: "sent",
    sentAt: ago(22),
  },
  {
    to: "+5491177886655",
    content: "⭐ ¡Premio listo, *Mariana*! Pasá por T4 Palermo a canjear tu Hojicha gratis.",
    status: "sent",
    sentAt: ago(47),
  },
  {
    to: "+5491133221100",
    content: "🔔 *Camila*, tu último sello fue hace 30 días. Volvé a vernos y completá tu tarjeta.",
    status: "sent",
    sentAt: ago(120),
  },
  {
    to: "+5491155555501",
    content: "🔒 *612388* es tu código de verificación para Loyalty. Expira en 5 minutos.",
    status: "sent",
    sentAt: ago(180),
  },
  {
    to: "+5491199887766",
    content: "📦 Tu pedido para retirar en mostrador ya está listo, *Diego*.",
    status: "sent",
    sentAt: ago(240),
  },
  {
    to: "+5491122334455",
    content: "Tu sesión en Loyalty se inició desde un dispositivo nuevo. Si no fuiste vos, respondé STOP.",
    status: "failed",
    sentAt: ago(360),
    metadata: { errorCode: "63015", reason: "Recipient not in Twilio sandbox" },
  },
  {
    to: "+5491166778899",
    content: "🎂 Ari, tu fecha de cumpleaños está cerca. ¡Pasá por T4 y te invitamos un té!",
    status: "sent",
    sentAt: ago(720),
  },
  {
    to: "+5491177886655",
    content: "Plantilla aprobada · Recordatorio mensual de saldo de sellos.",
    contentSid: "HX0a1b2c3d4e5f6789",
    contentVariables: { "1": "Mariana", "2": "3", "3": "5" },
    status: "sent",
    sentAt: ago(1440),
  },
];

const inserted = await db
  .insert(whatsappOutbox)
  .values(
    samples.map((s) => ({
      to: s.to,
      content: s.content,
      contentSid: s.contentSid,
      contentVariables: s.contentVariables,
      status: s.status,
      sentAt: s.sentAt,
      providerMessageId: `seed-${crypto.randomUUID()}`,
      metadata: s.metadata,
    })),
  )
  .returning({ id: whatsappOutbox.id, to: whatsappOutbox.to });

console.log(`Inserted ${inserted.length} rows into whatsapp_outbox:`);
for (const row of inserted) console.log(`  ${row.id}  ${row.to}`);
