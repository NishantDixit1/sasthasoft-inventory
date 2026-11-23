"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { buildSeed, purchaseTotal, salesTotal } from "./seed";
import type {
  ActivityEvent,
  AppData,
  ID,
  PurchaseLine,
  PurchaseOrder,
  Result,
  SalesChannel,
  SalesLine,
  SalesOrder,
  StockMovement,
  Transfer,
} from "./types";
import { addDays, todayISO } from "./utils";

/* -------------------------------- helpers -------------------------------- */

function nextNumber(existing: string[], prefix: string, fallback: number): string {
  const highest = existing.reduce((best, value) => {
    const digits = Number(value.replace(/\D/g, ""));
    return Number.isFinite(digits) && digits > best ? digits : best;
  }, fallback);
  return `${prefix}-${highest + 1}`;
}

function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

function fail(code: string, message: string): Result<never> {
  return { ok: false, error: { code, message } };
}

const CURRENT_USER = "Meena R";

/* --------------------------------- inputs -------------------------------- */

export interface SaleDraft {
  customerId: ID;
  godownId: ID;
  date: string;
  channel: SalesChannel;
  lines: SalesLine[];
  notes?: string;
  /** deliver straight away, taking the stock out in the same step */
  deliverNow: boolean;
}

export interface PurchaseDraft {
  supplierId: ID;
  godownId: ID;
  date: string;
  expectedDate: string;
  lines: Omit<PurchaseLine, "receivedQty">[];
  notes?: string;
}

export interface AdjustmentDraft {
  itemId: ID;
  godownId: ID;
  /** the counted quantity, not the delta */
  countedQty: number;
  reason: string;
}

export interface TransferDraft {
  fromGodownId: ID;
  toGodownId: ID;
  date: string;
  lines: { itemId: ID; qty: number }[];
  notes?: string;
}

/* --------------------------------- store --------------------------------- */

export interface AppState extends AppData {
  createSale: (draft: SaleDraft) => Result<SalesOrder>;
  deliverSale: (id: ID) => Result<SalesOrder>;
  recordSalePayment: (id: ID, amountInPaise: number) => Result<SalesOrder>;
  cancelSale: (id: ID) => Result<SalesOrder>;

  createPurchase: (draft: PurchaseDraft) => Result<PurchaseOrder>;
  receivePurchase: (id: ID, received: Record<ID, number>) => Result<PurchaseOrder>;
  recordPurchasePayment: (id: ID, amountInPaise: number) => Result<PurchaseOrder>;
  cancelPurchase: (id: ID) => Result<PurchaseOrder>;

  adjustStock: (draft: AdjustmentDraft) => Result<StockMovement | null>;
  createTransfer: (draft: TransferDraft) => Result<Transfer>;
  /** raise a draft purchase order for one item at its reorder quantity */
  reorder: (itemId: ID) => Result<PurchaseOrder>;

  resetDemo: () => void;
}

/** On-hand for one item in one godown, straight off the movement ledger. */
function onHandOf(movements: StockMovement[], itemId: ID, godownId: ID): number {
  return movements.reduce(
    (total, movement) =>
      movement.itemId === itemId && movement.godownId === godownId
        ? total + movement.qty
        : total,
    0,
  );
}

function makeMovements(
  existing: StockMovement[],
  entries: Omit<StockMovement, "id">[],
): StockMovement[] {
  let seq = existing.length;
  return entries.map((entry) => ({ ...entry, id: `mv-live-${++seq}-${entry.itemId}` }));
}

function makeActivity(
  existing: ActivityEvent[],
  event: Omit<ActivityEvent, "id" | "at" | "actor"> & { actor?: string },
): ActivityEvent {
  return {
    ...event,
    id: `ac-live-${existing.length + 1}`,
    at: new Date().toISOString(),
    actor: event.actor ?? CURRENT_USER,
  };
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      ...buildSeed(),

      /* ------------------------------ sales ------------------------------ */

      createSale: (draft) => {
        const state = get();
        if (draft.lines.length === 0) {
          return fail("EMPTY_ORDER", "Add at least one line item before saving.");
        }

        const order: SalesOrder = {
          id: `so-live-${state.salesOrders.length + 1}`,
          number: nextNumber(state.salesOrders.map((o) => o.number), "SO", 2000),
          customerId: draft.customerId,
          godownId: draft.godownId,
          date: draft.date,
          dueDate: addDays(draft.date, 21),
          channel: draft.channel,
          status: "confirmed",
          paymentStatus: "unpaid",
          amountPaid: 0,
          lines: draft.lines,
          notes: draft.notes,
        };

        const customer = state.customers.find((c) => c.id === draft.customerId);
        set({
          salesOrders: [order, ...state.salesOrders],
          activity: [
            makeActivity(state.activity, {
              kind: "sale.created",
              title: `${order.number} confirmed for ${customer?.name ?? "customer"}`,
              detail: `${order.lines.length} line items, ${salesTotal(order) / 100} rupees`,
              href: `/sales?focus=${order.id}`,
            }),
            ...state.activity,
          ],
        });

        if (draft.deliverNow) {
          const delivered = get().deliverSale(order.id);
          if (!delivered.ok) return delivered;
          return ok(delivered.data);
        }
        return ok(order);
      },

      deliverSale: (id) => {
        const state = get();
        const order = state.salesOrders.find((o) => o.id === id);
        if (!order) return fail("NOT_FOUND", "That sales order no longer exists.");
        if (order.status === "delivered") {
          return fail("ALREADY_DELIVERED", `${order.number} has already been delivered.`);
        }
        if (order.status === "cancelled") {
          return fail("CANCELLED", `${order.number} was cancelled and cannot be delivered.`);
        }
        if (order.lines.reduce((total, line) => total + line.qty, 0) <= 0) {
          return fail("EMPTY_ORDER", `${order.number} has no quantity to deliver.`);
        }

        // Check the whole order before moving anything, so a delivery is all or nothing.
        const short = order.lines
          .map((line) => ({
            line,
            available: onHandOf(state.movements, line.itemId, order.godownId),
          }))
          .filter((row) => row.available < row.line.qty);

        if (short.length > 0) {
          const names = short
            .map((row) => {
              const item = state.items.find((i) => i.id === row.line.itemId);
              return `${item?.name ?? row.line.itemId} (need ${row.line.qty}, have ${row.available})`;
            })
            .join(", ");
          return fail(
            "INSUFFICIENT_STOCK",
            `Not enough stock at this godown for ${names}.`,
          );
        }

        const now = new Date().toISOString();
        const godown = state.godowns.find((g) => g.id === order.godownId);
        const customer = state.customers.find((c) => c.id === order.customerId);

        const entries = order.lines.map<Omit<StockMovement, "id">>((line) => ({
          at: now,
          itemId: line.itemId,
          godownId: order.godownId,
          qty: -line.qty,
          type: "sale",
          refType: "sale",
          refId: order.id,
          refNumber: order.number,
          unitCost: state.items.find((i) => i.id === line.itemId)?.costPrice ?? 0,
          note: `Delivered against ${order.number}`,
          actor: CURRENT_USER,
        }));

        const updated: SalesOrder = {
          ...order,
          status: "delivered",
          deliveredAt: todayISO(),
        };

        set({
          salesOrders: state.salesOrders.map((o) => (o.id === id ? updated : o)),
          movements: [...state.movements, ...makeMovements(state.movements, entries)],
          activity: [
            makeActivity(state.activity, {
              kind: "sale.delivered",
              title: `${order.number} delivered to ${customer?.name ?? "customer"}`,
              detail: `${order.lines.reduce((t, l) => t + l.qty, 0)} units released from ${godown?.name ?? "stock"}`,
              href: `/sales?focus=${order.id}`,
            }),
            ...state.activity,
          ],
        });
        return ok(updated);
      },

      recordSalePayment: (id, amountInPaise) => {
        const state = get();
        const order = state.salesOrders.find((o) => o.id === id);
        if (!order) return fail("NOT_FOUND", "That sales order no longer exists.");
        if (amountInPaise <= 0) {
          return fail("INVALID_AMOUNT", "Enter an amount greater than zero.");
        }

        const total = salesTotal(order);
        const due = total - order.amountPaid;
        if (amountInPaise > due) {
          return fail(
            "OVER_PAYMENT",
            `That is more than the ${(due / 100).toFixed(2)} rupees still outstanding.`,
          );
        }

        const amountPaid = order.amountPaid + amountInPaise;
        const updated: SalesOrder = {
          ...order,
          amountPaid,
          paymentStatus: amountPaid >= total ? "paid" : "partial",
        };
        set({
          salesOrders: state.salesOrders.map((o) => (o.id === id ? updated : o)),
          activity: [
            makeActivity(state.activity, {
              kind: "sale.payment",
              title: `Payment recorded against ${order.number}`,
              detail: `${(amountInPaise / 100).toFixed(2)} rupees received`,
              href: `/sales?focus=${order.id}`,
            }),
            ...state.activity,
          ],
        });
        return ok(updated);
      },

      cancelSale: (id) => {
        const state = get();
        const order = state.salesOrders.find((o) => o.id === id);
        if (!order) return fail("NOT_FOUND", "That sales order no longer exists.");
        if (order.status === "delivered") {
          return fail(
            "ALREADY_DELIVERED",
            `${order.number} has shipped. Raise a return instead of cancelling.`,
          );
        }
        const updated: SalesOrder = { ...order, status: "cancelled" };
        set({
          salesOrders: state.salesOrders.map((o) => (o.id === id ? updated : o)),
          activity: [
            makeActivity(state.activity, {
              kind: "sale.cancelled",
              title: `${order.number} cancelled`,
              detail: "No stock was moved",
              href: `/sales?focus=${order.id}`,
            }),
            ...state.activity,
          ],
        });
        return ok(updated);
      },

      /* ---------------------------- purchases ---------------------------- */

      createPurchase: (draft) => {
        const state = get();
        if (draft.lines.length === 0) {
          return fail("EMPTY_ORDER", "Add at least one line item before saving.");
        }
        const supplier = state.suppliers.find((s) => s.id === draft.supplierId);
        const order: PurchaseOrder = {
          id: `po-live-${state.purchaseOrders.length + 1}`,
          number: nextNumber(state.purchaseOrders.map((o) => o.number), "PO", 1000),
          supplierId: draft.supplierId,
          godownId: draft.godownId,
          date: draft.date,
          expectedDate: draft.expectedDate,
          status: "ordered",
          paymentStatus: "unpaid",
          amountPaid: 0,
          lines: draft.lines.map((line) => ({ ...line, receivedQty: 0 })),
          notes: draft.notes,
        };
        set({
          purchaseOrders: [order, ...state.purchaseOrders],
          activity: [
            makeActivity(state.activity, {
              kind: "purchase.created",
              title: `${order.number} raised on ${supplier?.name ?? "supplier"}`,
              detail: `${order.lines.length} line items, expected ${draft.expectedDate}`,
              href: `/purchases?focus=${order.id}`,
            }),
            ...state.activity,
          ],
        });
        return ok(order);
      },

      receivePurchase: (id, received) => {
        const state = get();
        const order = state.purchaseOrders.find((o) => o.id === id);
        if (!order) return fail("NOT_FOUND", "That purchase order no longer exists.");
        if (order.status === "cancelled") {
          return fail("CANCELLED", `${order.number} was cancelled.`);
        }
        if (order.status === "received") {
          return fail("ALREADY_RECEIVED", `${order.number} is already fully received.`);
        }

        const entries: Omit<StockMovement, "id">[] = [];
        const now = new Date().toISOString();
        let receivedUnits = 0;

        const lines = order.lines.map((line) => {
          const qty = Math.max(0, Math.floor(received[line.itemId] ?? 0));
          const outstanding = line.qty - line.receivedQty;
          if (qty <= 0) return line;
          if (qty > outstanding) {
            // quietly cap rather than reject: receiving more than ordered is a
            // data entry slip, and the PO is the authority on the quantity
            return line;
          }
          receivedUnits += qty;
          entries.push({
            at: now,
            itemId: line.itemId,
            godownId: order.godownId,
            qty,
            type: "purchase",
            refType: "purchase",
            refId: order.id,
            refNumber: order.number,
            unitCost: line.rate,
            note: `Goods received against ${order.number}`,
            actor: CURRENT_USER,
          });
          return { ...line, receivedQty: line.receivedQty + qty };
        });

        if (entries.length === 0) {
          return fail("NOTHING_RECEIVED", "Enter a quantity against at least one line.");
        }

        const fullyReceived = lines.every((line) => line.receivedQty >= line.qty);
        const godown = state.godowns.find((g) => g.id === order.godownId);
        const updated: PurchaseOrder = {
          ...order,
          lines,
          status: fullyReceived ? "received" : "partial",
        };

        set({
          purchaseOrders: state.purchaseOrders.map((o) => (o.id === id ? updated : o)),
          movements: [...state.movements, ...makeMovements(state.movements, entries)],
          activity: [
            makeActivity(state.activity, {
              kind: "purchase.received",
              title: `${order.number} ${fullyReceived ? "received" : "part received"} into ${godown?.name ?? "stock"}`,
              detail: `${receivedUnits} units added to stock`,
              href: `/purchases?focus=${order.id}`,
            }),
            ...state.activity,
          ],
        });
        return ok(updated);
      },

      recordPurchasePayment: (id, amountInPaise) => {
        const state = get();
        const order = state.purchaseOrders.find((o) => o.id === id);
        if (!order) return fail("NOT_FOUND", "That purchase order no longer exists.");
        if (amountInPaise <= 0) {
          return fail("INVALID_AMOUNT", "Enter an amount greater than zero.");
        }
        const total = purchaseTotal(order);
        const due = total - order.amountPaid;
        if (amountInPaise > due) {
          return fail(
            "OVER_PAYMENT",
            `That is more than the ${(due / 100).toFixed(2)} rupees still outstanding.`,
          );
        }
        const amountPaid = order.amountPaid + amountInPaise;
        const updated: PurchaseOrder = {
          ...order,
          amountPaid,
          paymentStatus: amountPaid >= total ? "paid" : "partial",
        };
        set({
          purchaseOrders: state.purchaseOrders.map((o) => (o.id === id ? updated : o)),
          activity: [
            makeActivity(state.activity, {
              kind: "purchase.payment",
              title: `Payment made against ${order.number}`,
              detail: `${(amountInPaise / 100).toFixed(2)} rupees paid`,
              href: `/purchases?focus=${order.id}`,
            }),
            ...state.activity,
          ],
        });
        return ok(updated);
      },

      cancelPurchase: (id) => {
        const state = get();
        const order = state.purchaseOrders.find((o) => o.id === id);
        if (!order) return fail("NOT_FOUND", "That purchase order no longer exists.");
        if (order.status === "received" || order.status === "partial") {
          return fail(
            "ALREADY_RECEIVED",
            `Goods have already been received against ${order.number}.`,
          );
        }
        const updated: PurchaseOrder = { ...order, status: "cancelled" };
        set({
          purchaseOrders: state.purchaseOrders.map((o) => (o.id === id ? updated : o)),
          activity: [
            makeActivity(state.activity, {
              kind: "purchase.cancelled",
              title: `${order.number} cancelled`,
              detail: "No goods were received",
              href: `/purchases?focus=${order.id}`,
            }),
            ...state.activity,
          ],
        });
        return ok(updated);
      },

      /* ------------------------------ stock ------------------------------ */

      adjustStock: ({ itemId, godownId, countedQty, reason }) => {
        const state = get();
        const item = state.items.find((i) => i.id === itemId);
        if (!item) return fail("NOT_FOUND", "That item no longer exists.");
        if (countedQty < 0) {
          return fail("INVALID_QTY", "A counted quantity cannot be negative.");
        }

        const current = onHandOf(state.movements, itemId, godownId);
        const delta = countedQty - current;
        if (delta === 0) {
          return ok(null);
        }

        const entry: Omit<StockMovement, "id"> = {
          at: new Date().toISOString(),
          itemId,
          godownId,
          qty: delta,
          type: "adjustment",
          refType: "manual",
          refId: null,
          refNumber: "ADJ",
          unitCost: item.costPrice,
          note: reason,
          actor: CURRENT_USER,
        };
        const [movement] = makeMovements(state.movements, [entry]);

        set({
          movements: [...state.movements, movement],
          activity: [
            makeActivity(state.activity, {
              kind: "stock.adjusted",
              title: `${item.name} adjusted by ${delta > 0 ? "+" : ""}${delta}`,
              detail: reason,
              href: `/stock/${itemId}`,
            }),
            ...state.activity,
          ],
        });
        return ok(movement);
      },

      createTransfer: ({ fromGodownId, toGodownId, date, lines, notes }) => {
        const state = get();
        if (fromGodownId === toGodownId) {
          return fail("SAME_GODOWN", "Pick two different godowns.");
        }
        const usable = lines.filter((line) => line.qty > 0);
        if (usable.length === 0) {
          return fail("EMPTY_TRANSFER", "Add at least one item with a quantity.");
        }

        const short = usable
          .map((line) => ({
            line,
            available: onHandOf(state.movements, line.itemId, fromGodownId),
          }))
          .filter((row) => row.available < row.line.qty);
        if (short.length > 0) {
          const names = short
            .map((row) => {
              const item = state.items.find((i) => i.id === row.line.itemId);
              return `${item?.name ?? row.line.itemId} (have ${row.available})`;
            })
            .join(", ");
          return fail("INSUFFICIENT_STOCK", `Not enough stock to send ${names}.`);
        }

        const transfer: Transfer = {
          id: `tr-live-${state.transfers.length + 1}`,
          number: nextNumber(state.transfers.map((t) => t.number), "TR", 30),
          fromGodownId,
          toGodownId,
          date,
          status: "completed",
          lines: usable,
          notes,
        };

        const now = new Date().toISOString();
        const entries: Omit<StockMovement, "id">[] = [];
        for (const line of usable) {
          const unitCost = state.items.find((i) => i.id === line.itemId)?.costPrice ?? 0;
          entries.push({
            at: now, itemId: line.itemId, godownId: fromGodownId, qty: -line.qty,
            type: "transfer-out", refType: "transfer", refId: transfer.id,
            refNumber: transfer.number, unitCost,
            note: `Transferred out on ${transfer.number}`, actor: CURRENT_USER,
          });
          entries.push({
            at: now, itemId: line.itemId, godownId: toGodownId, qty: line.qty,
            type: "transfer-in", refType: "transfer", refId: transfer.id,
            refNumber: transfer.number, unitCost,
            note: `Transferred in on ${transfer.number}`, actor: CURRENT_USER,
          });
        }

        const to = state.godowns.find((g) => g.id === toGodownId);
        set({
          transfers: [transfer, ...state.transfers],
          movements: [...state.movements, ...makeMovements(state.movements, entries)],
          activity: [
            makeActivity(state.activity, {
              kind: "transfer.completed",
              title: `${transfer.number} completed`,
              detail: `${usable.length} items moved to ${to?.name ?? "godown"}`,
              href: "/godowns",
            }),
            ...state.activity,
          ],
        });
        return ok(transfer);
      },

      reorder: (itemId) => {
        const state = get();
        const item = state.items.find((i) => i.id === itemId);
        if (!item) return fail("NOT_FOUND", "That item no longer exists.");
        const supplier = state.suppliers.find((s) => s.id === item.preferredSupplierId);
        const today = todayISO();
        return get().createPurchase({
          supplierId: item.preferredSupplierId,
          godownId: state.godowns[0].id,
          date: today,
          expectedDate: addDays(today, supplier?.leadTimeDays ?? 7),
          lines: [{ itemId, qty: item.reorderQty, rate: item.costPrice, taxPct: 18 }],
          notes: `Auto-raised from the low stock alert for ${item.sku}.`,
        });
      },

      resetDemo: () => set({ ...buildSeed() }),
    }),
    {
      name: "sasthasoft-inventory",
      version: 2,
      // The store is created during SSR too, so hydration is triggered by hand
      // from the client once mounted. See StoreHydrator.
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        categories: state.categories,
        godowns: state.godowns,
        items: state.items,
        customers: state.customers,
        suppliers: state.suppliers,
        salesOrders: state.salesOrders,
        purchaseOrders: state.purchaseOrders,
        transfers: state.transfers,
        movements: state.movements,
        activity: state.activity,
      }),
    },
  ),
);
