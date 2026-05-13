import { Link } from "@/i18n/navigation";

type DevTool = {
  href: "/whatsapp-outbox" | "/sms-outbox";
  label: string;
};

const TOOLS: readonly DevTool[] = [
  { href: "/whatsapp-outbox", label: "WhatsApp Outbox" },
  { href: "/sms-outbox", label: "SMS Outbox" },
];

/**
 * Compact strip of links shown across every `(dev)` page so devs can
 * jump between debug views without keyboard-typing URLs. Intentionally
 * minimal — Tailwind classes only, no shadcn components — so the
 * layout fades into the background of whatever feature page is
 * showing.
 */
export function DevToolsNav() {
  return (
    <nav className="mx-auto flex max-w-6xl items-center gap-3 px-6 pt-4 text-xs">
      <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-100">
        dev
      </span>
      <ul className="flex flex-wrap items-center gap-3 text-muted-foreground">
        {TOOLS.map((tool) => (
          <li key={tool.href}>
            <Link
              href={tool.href}
              className="hover:text-foreground hover:underline"
            >
              {tool.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
