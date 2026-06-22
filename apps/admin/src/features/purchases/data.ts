// Hardcoded purchases data for the design-first transactions feed. Seams map
// onto the Phase A ledger (purchase / loyaltyCard / stamp): the rows, KPIs and
// receipt detail come from tRPC later. Amounts feed revenue + avg ticket; points
// are what the purchase earned the customer.

export type Purchase = {
  id: string;
  name: string;
  initials: string;
  item: string;
  store: string;
  amount: number;
  points: number;
  date: string;
};

export const stores: string[] = ["T4 Centro", "T4 Norte"];

export const purchaseKpis = [
  { key: "total", value: "1,284" },
  { key: "revenue", value: "$8.4K" },
  { key: "avgTicket", value: "$6.20" },
];

export const purchases: Purchase[] = [
  { id: "p_001", name: "María González", initials: "MG", item: "Taro Milk Tea L", store: "T4 Centro", amount: 7.4, points: 74, date: "hoy" },
  { id: "p_002", name: "Andrés Ramírez", initials: "AR", item: "Brown Sugar Boba M", store: "T4 Norte", amount: 5.9, points: 59, date: "hoy" },
  { id: "p_003", name: "Valentina Cruz", initials: "VC", item: "Matcha Latte L + Pudding", store: "T4 Centro", amount: 9.2, points: 92, date: "ayer" },
  { id: "p_004", name: "Camilo Torres", initials: "CT", item: "Thai Tea M", store: "T4 Norte", amount: 4.5, points: 45, date: "ayer" },
  { id: "p_005", name: "Laura Méndez", initials: "LM", item: "Wintermelon Tea L", store: "T4 Centro", amount: 6.1, points: 61, date: "hace 2 d" },
  { id: "p_006", name: "Daniela Pardo", initials: "DP", item: "Mango Slush M", store: "T4 Norte", amount: 5.5, points: 55, date: "hace 2 d" },
  { id: "p_007", name: "Sebastián Rojas", initials: "SR", item: "Classic Milk Tea M", store: "T4 Centro", amount: 4.2, points: 42, date: "hace 3 d" },
  { id: "p_008", name: "Paula Castaño", initials: "PC", item: "Strawberry Tea L + Boba", store: "T4 Norte", amount: 7.8, points: 78, date: "hace 3 d" },
  { id: "p_009", name: "Felipe Acosta", initials: "FA", item: "Oolong Milk Tea L", store: "T4 Centro", amount: 6.4, points: 64, date: "hace 4 d" },
  { id: "p_010", name: "Natalia Vega", initials: "NV", item: "Honey Lemon Tea M", store: "T4 Norte", amount: 4.8, points: 48, date: "hace 5 d" },
];

export type ReceiptItem = { name: string; qty: number; price: number };
export type Receipt = { items: ReceiptItem[]; subtotal: number; total: number };

/**
 * Hardcoded receipt detail for a purchase. The shape mirrors the eventual
 * ledger line items; the default sample is returned for any unknown id so the
 * design-first modal always has something to show.
 */
export function getReceipt(id: string): Receipt {
  const receipts: Record<string, Receipt> = {
    p_003: {
      items: [
        { name: "Matcha Latte L", qty: 1, price: 7.2 },
        { name: "Pudding topping", qty: 1, price: 2.0 },
      ],
      subtotal: 9.2,
      total: 9.2,
    },
    p_008: {
      items: [
        { name: "Strawberry Tea L", qty: 1, price: 6.3 },
        { name: "Boba topping", qty: 1, price: 1.5 },
      ],
      subtotal: 7.8,
      total: 7.8,
    },
  };

  return (
    receipts[id] ?? {
      items: [
        { name: "Taro Milk Tea L", qty: 1, price: 5.4 },
        { name: "Boba topping", qty: 1, price: 2.0 },
      ],
      subtotal: 7.4,
      total: 7.4,
    }
  );
}
