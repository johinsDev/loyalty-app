import { relations } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { organization } from "./auth";
import { customer } from "./loyalty";

// Product catalog (the menu). Multi-tenant from day one (org-scoped). v1 is
// customer-read-only + seeded; the admin CRUD comes later. Variants follow the
// Shopify model (options → variant combos with price + image); toppings are
// separate "modifier groups" (add-ons with selection rules + price delta).

export const category = sqliteTable(
  "category",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    slugPerOrg: uniqueIndex("category_slug_per_org_uq").on(t.organizationId, t.slug),
  }),
);

export const product = sqliteTable(
  "product",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    // Rich text (tiptap HTML).
    description: text("description"),
    // The default/shown price; variants may override.
    basePriceCents: integer("base_price_cents").notNull().default(0),
    currency: text("currency").notNull().default("COP"),
    status: text("status").notNull().default("active"), // active | draft | archived
    brand: text("brand"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    ogImageUrl: text("og_image_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    slugPerOrg: uniqueIndex("product_slug_per_org_uq").on(t.organizationId, t.slug),
    byOrgSort: index("product_org_sort_idx").on(
      t.organizationId,
      t.status,
      t.sortOrder,
      t.id,
    ),
  }),
);

export const productCategory = sqliteTable(
  "product_category",
  {
    productId: text("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: uniqueIndex("product_category_uq").on(t.productId, t.categoryId),
  }),
);

export const productOption = sqliteTable("product_option", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  productId: text("product_id")
    .notNull()
    .references(() => product.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g. "Tamaño", "Color"
  sortOrder: integer("sort_order").notNull().default(0),
});

export const productOptionValue = sqliteTable("product_option_value", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  optionId: text("option_id")
    .notNull()
    .references(() => productOption.id, { onDelete: "cascade" }),
  label: text("label").notNull(), // e.g. "Mediano"
  sortOrder: integer("sort_order").notNull().default(0),
});

export const productVariant = sqliteTable("product_variant", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  productId: text("product_id")
    .notNull()
    .references(() => product.id, { onDelete: "cascade" }),
  sku: text("sku"),
  priceCents: integer("price_cents").notNull(),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

// Links a variant to its option-value combo (one row per option axis).
export const productVariantValue = sqliteTable(
  "product_variant_value",
  {
    variantId: text("variant_id")
      .notNull()
      .references(() => productVariant.id, { onDelete: "cascade" }),
    optionValueId: text("option_value_id")
      .notNull()
      .references(() => productOptionValue.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: uniqueIndex("product_variant_value_uq").on(t.variantId, t.optionValueId),
  }),
);

export const productImage = sqliteTable("product_image", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  productId: text("product_id")
    .notNull()
    .references(() => product.id, { onDelete: "cascade" }),
  // When set, this image belongs to a specific variant (swaps on selection).
  variantId: text("variant_id").references(() => productVariant.id, {
    onDelete: "cascade",
  }),
  url: text("url").notNull(),
  alt: text("alt"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// A topping / add-on group. Distinct from variants — these don't change the
// product, they augment it. `priceDeltaCents` per option may be 0 (included).
export const modifierGroup = sqliteTable("modifier_group", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  productId: text("product_id")
    .notNull()
    .references(() => product.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // "Toppings", "Azúcar"
  selectionType: text("selection_type").notNull().default("multi"), // single | multi
  minSelect: integer("min_select").notNull().default(0),
  maxSelect: integer("max_select"),
  required: integer("required", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const modifierOption = sqliteTable("modifier_option", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  groupId: text("group_id")
    .notNull()
    .references(() => modifierGroup.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  priceDeltaCents: integer("price_delta_cents").notNull().default(0),
  pointsDelta: integer("points_delta"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// Curated menu section. `carousel` = a horizontal product row; `banner` = the
// featured callout (Spring drop). Placement decides where it renders.
export const section = sqliteTable("section", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  kind: text("kind").notNull().default("carousel"), // carousel | banner
  placement: text("placement").notNull().default("menu"), // menu | home | both
  sortOrder: integer("sort_order").notNull().default(0),
  bannerTitle: text("banner_title"),
  bannerSubtitle: text("banner_subtitle"),
  bannerImageUrl: text("banner_image_url"),
  bannerHref: text("banner_href"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const sectionProduct = sqliteTable(
  "section_product",
  {
    sectionId: text("section_id")
      .notNull()
      .references(() => section.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => ({
    pk: uniqueIndex("section_product_uq").on(t.sectionId, t.productId),
  }),
);

export const productFavorite = sqliteTable(
  "product_favorite",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    perCustomer: uniqueIndex("product_favorite_uq").on(t.customerId, t.productId),
  }),
);

// ---- Relations -------------------------------------------------------------

export const categoryRelations = relations(category, ({ one, many }) => ({
  organization: one(organization, {
    fields: [category.organizationId],
    references: [organization.id],
  }),
  products: many(productCategory),
}));

export const productRelations = relations(product, ({ one, many }) => ({
  organization: one(organization, {
    fields: [product.organizationId],
    references: [organization.id],
  }),
  categories: many(productCategory),
  options: many(productOption),
  variants: many(productVariant),
  images: many(productImage),
  modifierGroups: many(modifierGroup),
}));

export const productCategoryRelations = relations(productCategory, ({ one }) => ({
  product: one(product, {
    fields: [productCategory.productId],
    references: [product.id],
  }),
  category: one(category, {
    fields: [productCategory.categoryId],
    references: [category.id],
  }),
}));

export const productOptionRelations = relations(productOption, ({ one, many }) => ({
  product: one(product, {
    fields: [productOption.productId],
    references: [product.id],
  }),
  values: many(productOptionValue),
}));

export const productOptionValueRelations = relations(
  productOptionValue,
  ({ one }) => ({
    option: one(productOption, {
      fields: [productOptionValue.optionId],
      references: [productOption.id],
    }),
  }),
);

export const productVariantRelations = relations(productVariant, ({ one, many }) => ({
  product: one(product, {
    fields: [productVariant.productId],
    references: [product.id],
  }),
  values: many(productVariantValue),
  images: many(productImage),
}));

export const productVariantValueRelations = relations(
  productVariantValue,
  ({ one }) => ({
    variant: one(productVariant, {
      fields: [productVariantValue.variantId],
      references: [productVariant.id],
    }),
    optionValue: one(productOptionValue, {
      fields: [productVariantValue.optionValueId],
      references: [productOptionValue.id],
    }),
  }),
);

export const productImageRelations = relations(productImage, ({ one }) => ({
  product: one(product, {
    fields: [productImage.productId],
    references: [product.id],
  }),
  variant: one(productVariant, {
    fields: [productImage.variantId],
    references: [productVariant.id],
  }),
}));

export const modifierGroupRelations = relations(modifierGroup, ({ one, many }) => ({
  product: one(product, {
    fields: [modifierGroup.productId],
    references: [product.id],
  }),
  options: many(modifierOption),
}));

export const modifierOptionRelations = relations(modifierOption, ({ one }) => ({
  group: one(modifierGroup, {
    fields: [modifierOption.groupId],
    references: [modifierGroup.id],
  }),
}));

export const sectionRelations = relations(section, ({ one, many }) => ({
  organization: one(organization, {
    fields: [section.organizationId],
    references: [organization.id],
  }),
  products: many(sectionProduct),
}));

export const sectionProductRelations = relations(sectionProduct, ({ one }) => ({
  section: one(section, {
    fields: [sectionProduct.sectionId],
    references: [section.id],
  }),
  product: one(product, {
    fields: [sectionProduct.productId],
    references: [product.id],
  }),
}));

export const productFavoriteRelations = relations(productFavorite, ({ one }) => ({
  customer: one(customer, {
    fields: [productFavorite.customerId],
    references: [customer.id],
  }),
  product: one(product, {
    fields: [productFavorite.productId],
    references: [product.id],
  }),
}));

// ---- i18n + multi-currency -------------------------------------------------
// Base columns hold the org's default-locale content + default-currency price;
// these tables hold overrides for OTHER locales/currencies. Reads fall back to
// the base when a row is missing. Slug stays canonical (not translated).

export const productTranslation = sqliteTable(
  "product_translation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    productId: text("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    name: text("name").notNull(),
    description: text("description"),
  },
  (t) => ({
    uq: uniqueIndex("product_translation_uq").on(t.productId, t.locale),
  }),
);

export const categoryTranslation = sqliteTable(
  "category_translation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    categoryId: text("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    name: text("name").notNull(),
  },
  (t) => ({
    uq: uniqueIndex("category_translation_uq").on(t.categoryId, t.locale),
  }),
);

export const productPrice = sqliteTable(
  "product_price",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    productId: text("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    currency: text("currency").notNull(),
    amountCents: integer("amount_cents").notNull(),
  },
  (t) => ({
    uq: uniqueIndex("product_price_uq").on(t.productId, t.currency),
  }),
);

export const productVariantPrice = sqliteTable(
  "product_variant_price",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    variantId: text("variant_id")
      .notNull()
      .references(() => productVariant.id, { onDelete: "cascade" }),
    currency: text("currency").notNull(),
    amountCents: integer("amount_cents").notNull(),
  },
  (t) => ({
    uq: uniqueIndex("product_variant_price_uq").on(t.variantId, t.currency),
  }),
);

export const modifierOptionPrice = sqliteTable(
  "modifier_option_price",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    modifierOptionId: text("modifier_option_id")
      .notNull()
      .references(() => modifierOption.id, { onDelete: "cascade" }),
    currency: text("currency").notNull(),
    amountCents: integer("amount_cents").notNull(),
  },
  (t) => ({
    uq: uniqueIndex("modifier_option_price_uq").on(t.modifierOptionId, t.currency),
  }),
);

// ---- Row types -------------------------------------------------------------

export type ProductTranslationRow = typeof productTranslation.$inferSelect;
export type CategoryTranslationRow = typeof categoryTranslation.$inferSelect;
export type ProductPriceRow = typeof productPrice.$inferSelect;
export type ProductVariantPriceRow = typeof productVariantPrice.$inferSelect;
export type ModifierOptionPriceRow = typeof modifierOptionPrice.$inferSelect;

export type CategoryRow = typeof category.$inferSelect;
export type ProductRow = typeof product.$inferSelect;
export type ProductInsert = typeof product.$inferInsert;
export type ProductOptionRow = typeof productOption.$inferSelect;
export type ProductOptionValueRow = typeof productOptionValue.$inferSelect;
export type ProductVariantRow = typeof productVariant.$inferSelect;
export type ProductImageRow = typeof productImage.$inferSelect;
export type ModifierGroupRow = typeof modifierGroup.$inferSelect;
export type ModifierOptionRow = typeof modifierOption.$inferSelect;
export type SectionRow = typeof section.$inferSelect;
export type ProductFavoriteRow = typeof productFavorite.$inferSelect;
