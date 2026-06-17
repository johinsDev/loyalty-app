/**
 * The playful glossy emoji tile from the "T4 Onboarding · Fun" design — a
 * rounded gradient square with a soft teal shadow. `lg` is the hero size
 * (intro/success); the default is the per-screen header size.
 */
export function EmojiTile({
  children,
  size = "md",
  className = "",
}: {
  children: React.ReactNode;
  size?: "md" | "lg";
  className?: string;
}) {
  const dims =
    size === "lg"
      ? "size-36 rounded-[2.5rem] text-[78px]"
      : "size-28 rounded-[2rem] text-6xl";
  return (
    <div
      className={`flex items-center justify-center bg-linear-to-b from-[#f1fffb] to-[#d6f6ed] shadow-xl shadow-primary/35 ${dims} ${className}`}
    >
      {children}
    </div>
  );
}
