import { z } from "zod";

/**
 * Room id the caller wants a ticket for. We pattern-match the prefix
 * against the kinds the realtime channel knows about — the service
 * decides whether the caller can actually join.
 */
export const issueTicketInputSchema = z.object({
  roomId: z
    .string()
    .min(1)
    .regex(
      /^(customer|org|chat):.+$/,
      "roomId must match 'customer:<id>', 'org:<id>' or 'chat:<id>'",
    ),
});

/**
 * Dev-only helper: publish an arbitrary event into your own customer
 * room. Gated by `isDevOnlyEnabled()` at the router so it 404s in
 * production. Useful for the (dev)/realtime smoke page.
 */
export const publishHelloInputSchema = z.object({
  roomId: z.string().min(1),
  message: z.string().max(280).default("hello"),
});

export type IssueTicketInput = z.infer<typeof issueTicketInputSchema>;
