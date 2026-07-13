/**
 * Avatar initials for a customer. Phone-first signups have no name (or carry
 * the phone number *as* the name), and slicing those yields "+5" — so fall back
 * to the last two digits of the phone instead.
 */
export function customerInitials(name: string | null, phone: string): string {
  const words = (name ?? "").split(/\s+/).filter((w) => /\p{L}/u.test(w));
  if (words.length > 0) {
    return words
      .slice(0, 2)
      .map((w) => [...w][0])
      .join("")
      .toUpperCase();
  }
  return phone.replaceAll(/\D/g, "").slice(-2);
}
