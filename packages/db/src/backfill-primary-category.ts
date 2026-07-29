import { sql } from "drizzle-orm";

import { db } from "./client";

/**
 * CLI: one-time backfill of `product_category.is_primary`. A product may sit in
 * several categories, but revenue is attributed to exactly one — otherwise the
 * per-category totals would exceed the business total. Products that already
 * have a primary are skipped, so this is idempotent.
 *
 * The chosen primary is the assigned category with the lowest `sort_order`,
 * which is exactly the read-time fallback used by the tree + dashboard queries.
 * So running this changes no numbers — it just makes the attribution explicit
 * and editable from the category picker.
 *
 * Usage:
 *   bun run db:backfill-primary-category
 */
const countPrimaries = () =>
  db.get<{ n: number }>(sql`select count(*) as n from product_category where is_primary = 1`);

async function main() {
  const before = await countPrimaries();

  await db.run(sql`
    update product_category
       set is_primary = 1
     where rowid in (
       select rowid from (
         select pc.rowid as rowid,
                row_number() over (
                  partition by pc.product_id
                  order by c.sort_order asc, pc.rowid asc
                ) as rn
           from product_category pc
           join category c on c.id = pc.category_id
          where pc.product_id not in (
                  select product_id from product_category where is_primary = 1
                )
       )
      where rn = 1
     )
  `);

  const after = await countPrimaries();
  const orphans = await db.get<{ n: number }>(sql`
    select count(distinct product_id) as n
      from product_category
     where product_id not in (select product_id from product_category where is_primary = 1)
  `);

  console.log(
    `✅ Primary categories: ${before?.n ?? 0} → ${after?.n ?? 0}. ` +
      `Products still without one: ${orphans?.n ?? 0} (expected 0).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
