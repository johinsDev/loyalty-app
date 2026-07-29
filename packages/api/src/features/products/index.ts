export { menuRouter, buildMenuService } from "./router";
export { ProductsRepository } from "./repository";
export { ProductsAdminRepository } from "./admin-repository";
// Moved to `features/ingredients`; re-exported so existing importers (jobs,
// admin) keep resolving while they migrate.
export { IngredientsRepository } from "../ingredients";
export { MenuService } from "./service";
export { earnFor } from "./earn";
export type {
  ProductUpsertInput,
  ProductAdminDetail,
  ProductAdminRow,
  ProductAdminList,
  ProductAdminListInput,
} from "./write-schemas";
