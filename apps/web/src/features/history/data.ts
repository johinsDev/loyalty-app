/**
 * Hardcoded demo content for the customer purchase history — a faithful build of
 * the "T4 · Historial" Claude Design template. Everything here is sample data
 * (orders, items, amounts, dates) until the purchases/ledger API lands; chrome
 * copy (labels, chips, receipt) is translated via the `History` namespace.
 */

export type Period = "todo" | "mes" | "pasado";

export type OrderItem = { qty: number; name: string; price: string };

export type Order = {
  id: string;
  /** Which period bucket the order belongs to. */
  period: Exclude<Period, "todo">;
  /** Day group label, e.g. "Hoy" or "14 jun". */
  group: string;
  store: string;
  date: string;
  time: string;
  emoji: string;
  total: string;
  subtotal: string;
  points: number;
  sellos: number;
  pay: string;
  payIcon: string;
  orderNo: string;
  items: OrderItem[];
};

/** Month the summary card covers (content — stays inline like dates/amounts). */
export const summaryMonth = "Junio";

export const orders: readonly Order[] = [
  {
    id: "o1",
    period: "mes",
    group: "Hoy",
    store: "T4 Palermo",
    date: "18 jun 2026",
    time: "14:20",
    emoji: "🧋",
    total: "$3.800",
    subtotal: "$3.800",
    points: 38,
    sellos: 2,
    pay: "Visa ····4582",
    payIcon: "💳",
    orderNo: "#T4-90213",
    items: [
      { qty: 1, name: "Brown Sugar Milk Tea G", price: "$2.300" },
      { qty: 1, name: "Matcha Latte M", price: "$1.500" },
    ],
  },
  {
    id: "o2",
    period: "mes",
    group: "Hoy",
    store: "T4 Palermo",
    date: "18 jun 2026",
    time: "09:05",
    emoji: "🍵",
    total: "$1.900",
    subtotal: "$1.900",
    points: 19,
    sellos: 1,
    pay: "Efectivo",
    payIcon: "💵",
    orderNo: "#T4-90188",
    items: [
      { qty: 1, name: "Matcha Latte M", price: "$1.500" },
      { qty: 1, name: "Topping perlas", price: "$400" },
    ],
  },
  {
    id: "o3",
    period: "mes",
    group: "Ayer · 17 jun",
    store: "T4 Centro",
    date: "17 jun 2026",
    time: "18:42",
    emoji: "🥤",
    total: "$5.100",
    subtotal: "$5.100",
    points: 51,
    sellos: 3,
    pay: "Mercado Pago",
    payIcon: "📱",
    orderNo: "#T4-89740",
    items: [
      { qty: 2, name: "Taro Milk Tea G", price: "$4.200" },
      { qty: 1, name: "Pancito relleno", price: "$900" },
    ],
  },
  {
    id: "o4",
    period: "mes",
    group: "14 jun",
    store: "T4 Palermo",
    date: "14 jun 2026",
    time: "16:10",
    emoji: "🍓",
    total: "$2.300",
    subtotal: "$2.300",
    points: 23,
    sellos: 1,
    pay: "Visa ····4582",
    payIcon: "💳",
    orderNo: "#T4-88512",
    items: [{ qty: 1, name: "Strawberry Fresh Tea G", price: "$2.300" }],
  },
  {
    id: "o5",
    period: "pasado",
    group: "28 may",
    store: "T4 Centro",
    date: "28 may 2026",
    time: "13:30",
    emoji: "🧋",
    total: "$4.600",
    subtotal: "$4.600",
    points: 46,
    sellos: 2,
    pay: "Mercado Pago",
    payIcon: "📱",
    orderNo: "#T4-84120",
    items: [
      { qty: 2, name: "Brown Sugar Milk Tea M", price: "$3.800" },
      { qty: 1, name: "Topping pudín", price: "$800" },
    ],
  },
  {
    id: "o6",
    period: "pasado",
    group: "21 may",
    store: "T4 Palermo",
    date: "21 may 2026",
    time: "11:15",
    emoji: "🍑",
    total: "$2.100",
    subtotal: "$2.100",
    points: 21,
    sellos: 1,
    pay: "Efectivo",
    payIcon: "💵",
    orderNo: "#T4-82003",
    items: [{ qty: 1, name: "Peach Oolong Tea M", price: "$2.100" }],
  },
];

/** Orders for a period filter ("todo" = all). */
export function ordersForPeriod(period: Period): Order[] {
  return orders.filter((o) => period === "todo" || o.period === period);
}

/** Current-month totals shown in the summary card. */
export function monthSummary() {
  const mes = orders.filter((o) => o.period === "mes");
  return {
    visits: mes.length,
    points: mes.reduce((a, o) => a + o.points, 0),
    sellos: mes.reduce((a, o) => a + o.sellos, 0),
  };
}

export type OrderGroup = { label: string; count: number; orders: Order[] };

/** Group orders by their day label, preserving first-seen order. */
export function groupByDay(list: Order[]): OrderGroup[] {
  const map = new Map<string, Order[]>();
  for (const o of list) {
    const bucket = map.get(o.group);
    if (bucket) bucket.push(o);
    else map.set(o.group, [o]);
  }
  return [...map.entries()].map(([label, group]) => ({
    label,
    count: group.length,
    orders: group,
  }));
}

/** One-line summary of an order for the list row. */
export function orderSummary(o: Order): string {
  const [first, ...rest] = o.items;
  if (!first) return "";
  if (rest.length === 0) {
    return (first.qty > 1 ? `${first.qty}× ` : "") + first.name;
  }
  return `${first.name} +${rest.length}`;
}

export const orderById = (id: string) => orders.find((o) => o.id === id) ?? null;
