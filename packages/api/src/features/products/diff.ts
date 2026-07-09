/**
 * Partition a child collection for an upsert-by-id: which existing rows to
 * delete, and (implicitly) which incoming ids survive as updates vs inserts.
 *
 * The ID-stability guarantee lives here: an id present in BOTH `existingIds`
 * and `incomingIds` is NEVER in `toDelete`, so its row is updated in place and
 * its id is preserved — which is what keeps promo + reward JSON rules (that
 * reference variant/modifierOption ids with no FK) pointing at live rows across
 * a product edit.
 */
export function partitionById(
  existingIds: readonly string[],
  incomingIds: readonly string[],
): { toDelete: string[]; toUpdate: string[]; toInsert: string[] } {
  const existing = new Set(existingIds);
  const incoming = new Set(incomingIds);
  return {
    toDelete: existingIds.filter((id) => !incoming.has(id)),
    toUpdate: incomingIds.filter((id) => existing.has(id)),
    toInsert: incomingIds.filter((id) => !existing.has(id)),
  };
}
