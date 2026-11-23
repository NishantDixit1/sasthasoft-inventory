/**
 * Every number shown in the UI is derived here from the raw records, so there
 * is exactly one definition of "on hand", "low stock" or "revenue" in the app.
 * Components stay presentational and the modules can never disagree.
 */

import { purchaseTotal, salesLineNet, salesLineTax, salesTotal } from "./seed";
import type {
  AppData,
  Category,
  Customer,
  Godown,
  DateRange,
  ID,
  Item,
  ItemStock,
  PurchaseOrder,
  SalesOrder,
  StockHealth,
  StockMovement,
  Supplier,
} from "./types";
import { addDays, groupBy, todayISO } from "./utils";

export function indexById<T extends { id: ID }>(rows: T[]): Record<ID, T> {
  return Object.fromEntries(rows.map((row) => [row.id, row]));
}

export function healthOf(onHand: number, item: Item): StockHealth {
  if (onHand <= 0) return "out";
  if (onHand < item.minLevel * 0.5) return "critical";
  if (onHand < item.minLevel) return "low";
  if (onHand > (item.minLevel + item.reorderQty) * 2.4) return "excess";
  return "healthy";
}

export const HEALTH_LABEL: Record<StockHealth, string> = {
  out: "Out of stock",
  critical: "Critical",
  low: "Low stock",
  healthy: "In stock",
  excess: "Overstocked",
};

/** The slice of state the stock roll-up actually needs. */
export type StockInput = Pick<
  AppData,
  "items" | "movements" | "salesOrders" | "purchaseOrders"
>;

/** On-hand per item, rolled up from the movement ledger. */
export function buildStock(data: StockInput): ItemStock[] {
  const byItem = new Map<ID, { total: number; byGodown: Record<ID, number>; last: string | null }>();
  for (const item of data.items) {
    byItem.set(item.id, { total: 0, byGodown: {}, last: null });
  }
  for (const movement of data.movements) {
    const bucket = byItem.get(movement.itemId);
    if (!bucket) continue;
    bucket.total += movement.qty;
    bucket.byGodown[movement.godownId] =
      (bucket.byGodown[movement.godownId] ?? 0) + movement.qty;
    if (!bucket.last || movement.at > bucket.last) bucket.last = movement.at;
  }

  const committed = new Map<ID, number>();
  for (const order of data.salesOrders) {
    if (order.status !== "confirmed") continue;
    for (const line of order.lines) {
      committed.set(line.itemId, (committed.get(line.itemId) ?? 0) + line.qty);
    }
  }

  const incoming = new Map<ID, number>();
  for (const order of data.purchaseOrders) {
    if (order.status !== "ordered" && order.status !== "partial") continue;
    for (const line of order.lines) {
      const open = Math.max(0, line.qty - line.receivedQty);
      incoming.set(line.itemId, (incoming.get(line.itemId) ?? 0) + open);
    }
  }

  return data.items.map((item) => {
    const bucket = byItem.get(item.id)!;
    const onHand = bucket.total;
    const committedQty = committed.get(item.id) ?? 0;
    return {
      item,
      onHand,
      byGodown: bucket.byGodown,
      committed: committedQty,
      incoming: incoming.get(item.id) ?? 0,
      available: onHand - committedQty,
      health: healthOf(onHand, item),
      value: onHand * item.costPrice,
      lastMovementAt: bucket.last,
    };
  });
}

export function stockForItem(stock: ItemStock[], itemId: ID): ItemStock | undefined {
  return stock.find((row) => row.item.id === itemId);
}

export function lowStock(stock: ItemStock[]): ItemStock[] {
  const rank: Record<string, number> = { out: 0, critical: 1, low: 2 };
  return stock
    .filter((row) => row.health === "out" || row.health === "critical" || row.health === "low")
    .sort((a, b) => {
      const byRank = rank[a.health] - rank[b.health];
      if (byRank !== 0) return byRank;
      return a.onHand / Math.max(1, a.item.minLevel) - b.onHand / Math.max(1, b.item.minLevel);
    });
}

/* ------------------------------ money rollups ----------------------------- */

export function inRange(iso: string, range: DateRange): boolean {
  const day = iso.slice(0, 10);
  return day >= range.from && day <= range.to;
}

export function lastNDays(days: number): DateRange {
  const to = todayISO();
  return { from: addDays(to, -(days - 1)), to };
}

export interface SalesRollup {
  orders: number;
  units: number;
  revenue: number;
  tax: number;
  discount: number;
  cost: number;
  margin: number;
  received: number;
  outstanding: number;
}

export function rollupSales(orders: SalesOrder[], items: Record<ID, Item>): SalesRollup {
  const rollup: SalesRollup = {
    orders: orders.length,
    units: 0,
    revenue: 0,
    tax: 0,
    discount: 0,
    cost: 0,
    margin: 0,
    received: 0,
    outstanding: 0,
  };
  for (const order of orders) {
    for (const line of order.lines) {
      rollup.units += line.qty;
      rollup.revenue += salesLineNet(line);
      rollup.tax += salesLineTax(line);
      rollup.discount += Math.round(line.qty * line.rate * (line.discountPct / 100));
      rollup.cost += line.qty * (items[line.itemId]?.costPrice ?? 0);
    }
    const total = salesTotal(order);
    rollup.received += order.amountPaid;
    rollup.outstanding += Math.max(0, total - order.amountPaid);
  }
  rollup.margin = rollup.revenue - rollup.cost;
  return rollup;
}

export interface PurchaseRollup {
  orders: number;
  units: number;
  received: number;
  value: number;
  tax: number;
  paid: number;
  outstanding: number;
}

export function rollupPurchases(orders: PurchaseOrder[]): PurchaseRollup {
  const rollup: PurchaseRollup = {
    orders: orders.length,
    units: 0,
    received: 0,
    value: 0,
    tax: 0,
    paid: 0,
    outstanding: 0,
  };
  for (const order of orders) {
    for (const line of order.lines) {
      rollup.units += line.qty;
      rollup.received += line.receivedQty;
      rollup.value += line.qty * line.rate;
      rollup.tax += Math.round(line.qty * line.rate * (line.taxPct / 100));
    }
    const total = purchaseTotal(order);
    rollup.paid += order.amountPaid;
    if (order.status !== "cancelled") {
      rollup.outstanding += Math.max(0, total - order.amountPaid);
    }
  }
  return rollup;
}

/* -------------------------------- series ---------------------------------- */

export interface SeriesPoint {
  label: string;
  /** bucket start, used as a stable key */
  key: string;
  sales: number;
  purchases: number;
}

/** Sales vs purchases bucketed into equal-width day blocks. */
export function tradeSeries(
  salesOrders: SalesOrder[],
  purchaseOrders: PurchaseOrder[],
  days: number,
  buckets: number,
): SeriesPoint[] {
  const to = todayISO();
  const width = Math.ceil(days / buckets);
  const points: SeriesPoint[] = [];

  for (let index = buckets - 1; index >= 0; index -= 1) {
    const end = addDays(to, -index * width);
    const begin = addDays(end, -(width - 1));
    const range = { from: begin, to: end };

    const sales = salesOrders
      .filter((order) => order.status !== "cancelled" && inRange(order.date, range))
      .reduce((total, order) => total + salesTotal(order), 0);

    const purchases = purchaseOrders
      .filter((order) => order.status !== "cancelled" && inRange(order.date, range))
      .reduce((total, order) => total + purchaseTotal(order), 0);

    points.push({ label: shortBucketLabel(begin), key: begin, sales, purchases });
  }
  return points;
}

function shortBucketLabel(iso: string): string {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export interface RankedItem {
  item: Item;
  units: number;
  revenue: number;
  margin: number;
}

export function topItems(
  orders: SalesOrder[],
  items: Record<ID, Item>,
  limit = 5,
): RankedItem[] {
  const totals = new Map<ID, RankedItem>();
  for (const order of orders) {
    if (order.status === "cancelled") continue;
    for (const line of order.lines) {
      const item = items[line.itemId];
      if (!item) continue;
      const entry = totals.get(item.id) ?? { item, units: 0, revenue: 0, margin: 0 };
      entry.units += line.qty;
      entry.revenue += salesLineNet(line);
      entry.margin += salesLineNet(line) - line.qty * item.costPrice;
      totals.set(item.id, entry);
    }
  }
  return [...totals.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

export interface PartyRollup<T> {
  party: T;
  orders: number;
  value: number;
  outstanding: number;
  lastOrder: string | null;
}

export function rollupByCustomer(
  orders: SalesOrder[],
  customers: Customer[],
): PartyRollup<Customer>[] {
  const grouped = groupBy(
    orders.filter((order) => order.status !== "cancelled"),
    (order) => order.customerId,
  );
  return customers
    .map((customer) => {
      const rows = grouped[customer.id] ?? [];
      return {
        party: customer,
        orders: rows.length,
        value: rows.reduce((total, order) => total + salesTotal(order), 0),
        outstanding: rows.reduce(
          (total, order) => total + Math.max(0, salesTotal(order) - order.amountPaid),
          0,
        ),
        lastOrder: rows.reduce<string | null>(
          (latest, order) => (!latest || order.date > latest ? order.date : latest),
          null,
        ),
      };
    })
    .sort((a, b) => b.value - a.value);
}

export function rollupBySupplier(
  orders: PurchaseOrder[],
  suppliers: Supplier[],
): PartyRollup<Supplier>[] {
  const grouped = groupBy(
    orders.filter((order) => order.status !== "cancelled"),
    (order) => order.supplierId,
  );
  return suppliers
    .map((supplier) => {
      const rows = grouped[supplier.id] ?? [];
      return {
        party: supplier,
        orders: rows.length,
        value: rows.reduce((total, order) => total + purchaseTotal(order), 0),
        outstanding: rows.reduce(
          (total, order) => total + Math.max(0, purchaseTotal(order) - order.amountPaid),
          0,
        ),
        lastOrder: rows.reduce<string | null>(
          (latest, order) => (!latest || order.date > latest ? order.date : latest),
          null,
        ),
      };
    })
    .sort((a, b) => b.value - a.value);
}

/* ------------------------------- ledger view ------------------------------ */

export interface LedgerRow extends StockMovement {
  balance: number;
}

/** Movements for one item, oldest first, with a running balance. */
export function itemLedger(
  movements: StockMovement[],
  itemId: ID,
  godownId?: ID,
): LedgerRow[] {
  let balance = 0;
  return movements
    .filter((m) => m.itemId === itemId && (!godownId || m.godownId === godownId))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
    .map((movement) => {
      balance += movement.qty;
      return { ...movement, balance };
    });
}

export function godownUsage(godowns: Godown[], stock: ItemStock[]) {
  return godowns.map((godown) => {
    let units = 0;
    let value = 0;
    for (const row of stock) {
      const qty = row.byGodown[godown.id] ?? 0;
      if (qty <= 0) continue;
      units += qty;
      value += qty * row.item.costPrice;
    }
    return {
      godown,
      units,
      value,
      utilisation: Math.min(100, Math.round((units / godown.capacity) * 100)),
      skus: stock.filter((row) => (row.byGodown[godown.id] ?? 0) > 0).length,
    };
  });
}

export function categoryBreakdown(categories: Category[], stock: ItemStock[]) {
  return categories
    .map((category) => {
      const rows = stock.filter((row) => row.item.categoryId === category.id);
      return {
        category,
        skus: rows.length,
        units: rows.reduce((total, row) => total + Math.max(0, row.onHand), 0),
        value: rows.reduce((total, row) => total + Math.max(0, row.value), 0),
      };
    })
    .sort((a, b) => b.value - a.value);
}
