import { Bell, Mail, MessageCircle, MessageSquare, type LucideIcon } from "lucide-react";

const CHANNEL_ICON: Record<string, LucideIcon> = {
  push: Bell,
  email: Mail,
  sms: MessageSquare,
  whatsapp: MessageCircle,
};

/** Row of channel glyphs for a campaign's delivery priority — shared, non-
 *  interactive, so it renders in both the server table and the client grid card. */
export function ChannelIcons({ channels }: { channels: string[] }) {
  if (channels.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-1">
      {channels.map((c) => {
        const Icon = CHANNEL_ICON[c];
        if (!Icon) return null;
        return (
          <span
            key={c}
            className="bg-muted text-muted-foreground grid size-6 place-items-center rounded-md"
          >
            <Icon className="size-3" />
          </span>
        );
      })}
    </div>
  );
}
