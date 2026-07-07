import type { EditorVariable } from "@loyalty/ui";

/**
 * User/store merge variables shared by the campaign wizard and the banner
 * announce composer. Entity variables (promo/product/reward with a picker) are
 * wizard-only and live in the wizard.
 */
export const CAMPAIGN_VARS: EditorVariable[] = [
  { token: "{{user.name}}", label: "Nombre de usuario", hint: "El nombre del cliente" },
  { token: "{{user.phone}}", label: "Teléfono", hint: "El teléfono del cliente" },
  { token: "{{user.tier}}", label: "Nivel", hint: "El nivel/tier actual del cliente" },
  { token: "{{user.points}}", label: "Puntos", hint: "Puntos disponibles del cliente" },
  { token: "{{user.stamps}}", label: "Sellos", hint: "Sellos en la tarjeta activa" },
  { token: "{{store.name}}", label: "Sucursal", hint: "El nombre de la sucursal" },
  { token: "{{store.address}}", label: "Dirección", hint: "La dirección de la sucursal" },
  { token: "{{store.phone}}", label: "Tel. sucursal", hint: "El teléfono de la sucursal" },
  { token: "{{store.instagram}}", label: "Instagram", hint: "El Instagram de la sucursal" },
];
