"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import { buildStock, indexById, lowStock } from "./selectors";
import { useApp } from "./store";
import type { Customer, Godown, ID, Item, ItemStock, Supplier } from "./types";

/** On-hand, committed, incoming and health for every item. */
export function useStock(): ItemStock[] {
  const input = useApp(
    useShallow((state) => ({
      items: state.items,
      movements: state.movements,
      salesOrders: state.salesOrders,
      purchaseOrders: state.purchaseOrders,
    })),
  );
  return useMemo(() => buildStock(input), [input]);
}

export function useLowStock(): ItemStock[] {
  const stock = useStock();
  return useMemo(() => lowStock(stock), [stock]);
}

/** Lookup tables for the master records, so cells can resolve ids cheaply. */
export function useLookups(): {
  items: Record<ID, Item>;
  customers: Record<ID, Customer>;
  suppliers: Record<ID, Supplier>;
  godowns: Record<ID, Godown>;
} {
  const masters = useApp(
    useShallow((state) => ({
      items: state.items,
      customers: state.customers,
      suppliers: state.suppliers,
      godowns: state.godowns,
    })),
  );
  return useMemo(
    () => ({
      items: indexById(masters.items),
      customers: indexById(masters.customers),
      suppliers: indexById(masters.suppliers),
      godowns: indexById(masters.godowns),
    }),
    [masters],
  );
}

/** On-hand for one item in one godown, straight from the ledger. */
export function useOnHand(itemId: ID | null, godownId: ID | null): number {
  const movements = useApp((state) => state.movements);
  return useMemo(() => {
    if (!itemId || !godownId) return 0;
    return movements.reduce(
      (total, movement) =>
        movement.itemId === itemId && movement.godownId === godownId
          ? total + movement.qty
          : total,
      0,
    );
  }, [movements, itemId, godownId]);
}
