"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Boxes,
  Building2,
  CornerDownLeft,
  ReceiptIndianRupee,
  Search,
  Truck,
  Users,
} from "lucide-react";

import { money } from "@/lib/format";
import { NAV } from "@/lib/nav";
import { useApp } from "@/lib/store";
import { salesTotal, purchaseTotal } from "@/lib/seed";
import { cn } from "@/lib/utils";

interface Hit {
  id: string;
  group: string;
  title: string;
  caption: string;
  href: string;
  icon: typeof Boxes;
}

const LIMIT_PER_GROUP = 4;

/**
 * Cmd+K search across every module. One keystroke to any record, which is the
 * difference between a demo and something an operator would actually live in.
 */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  const items = useApp((state) => state.items);
  const customers = useApp((state) => state.customers);
  const suppliers = useApp((state) => state.suppliers);
  const salesOrders = useApp((state) => state.salesOrders);
  const purchaseOrders = useApp((state) => state.purchaseOrders);

  const hits = useMemo<Hit[]>(() => {
    const needle = query.trim().toLowerCase();
    const matches = (...fields: string[]) =>
      !needle || fields.some((field) => field.toLowerCase().includes(needle));

    const pages: Hit[] = NAV.flatMap((section) => section.items)
      .filter((item) => matches(item.label))
      .slice(0, LIMIT_PER_GROUP)
      .map((item) => ({
        id: `page-${item.href}`,
        group: "Go to",
        title: item.label,
        caption: item.href,
        href: item.href,
        icon: item.icon,
      }));

    const itemHits: Hit[] = items
      .filter((item) => matches(item.name, item.sku, item.brand))
      .slice(0, LIMIT_PER_GROUP)
      .map((item) => ({
        id: `item-${item.id}`,
        group: "Items",
        title: item.name,
        caption: `${item.sku} · ${item.brand}`,
        href: `/stock/${item.id}`,
        icon: Boxes,
      }));

    const saleHits: Hit[] = salesOrders
      .filter((order) => {
        const customer = customers.find((c) => c.id === order.customerId);
        return matches(order.number, customer?.name ?? "");
      })
      .slice(0, LIMIT_PER_GROUP)
      .map((order) => ({
        id: `sale-${order.id}`,
        group: "Sales orders",
        title: order.number,
        caption: `${customers.find((c) => c.id === order.customerId)?.name ?? ""} · ${money(salesTotal(order))}`,
        href: `/sales?focus=${order.id}`,
        icon: ReceiptIndianRupee,
      }));

    const purchaseHits: Hit[] = purchaseOrders
      .filter((order) => {
        const supplier = suppliers.find((s) => s.id === order.supplierId);
        return matches(order.number, supplier?.name ?? "");
      })
      .slice(0, LIMIT_PER_GROUP)
      .map((order) => ({
        id: `purchase-${order.id}`,
        group: "Purchase orders",
        title: order.number,
        caption: `${suppliers.find((s) => s.id === order.supplierId)?.name ?? ""} · ${money(purchaseTotal(order))}`,
        href: `/purchases?focus=${order.id}`,
        icon: Truck,
      }));

    const partyHits: Hit[] = [
      ...customers.filter((c) => matches(c.name, c.city, c.code)).slice(0, 3).map((c) => ({
        id: `customer-${c.id}`,
        group: "Customers",
        title: c.name,
        caption: `${c.code} · ${c.city}`,
        href: `/customers?focus=${c.id}`,
        icon: Users,
      })),
      ...suppliers.filter((s) => matches(s.name, s.city, s.code)).slice(0, 3).map((s) => ({
        id: `supplier-${s.id}`,
        group: "Suppliers",
        title: s.name,
        caption: `${s.code} · ${s.city}`,
        href: `/suppliers?focus=${s.id}`,
        icon: Building2,
      })),
    ];

    return [...pages, ...itemHits, ...saleHits, ...purchaseHits, ...partyHits];
  }, [query, items, customers, suppliers, salesOrders, purchaseOrders]);

  // mounted only while open, so the field starts empty every time
  useEffect(() => {
    // let the portal paint before taking focus
    const timer = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setCursor((value) => Math.min(hits.length - 1, value + 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setCursor((value) => Math.max(0, value - 1));
      }
      if (event.key === "Enter" && hits[cursor]) {
        event.preventDefault();
        router.push(hits[cursor].href);
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hits, cursor, router, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-overlay backdrop-blur-[2px] animate-fade" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-lg animate-scale-in"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 shrink-0 text-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            placeholder="Search items, orders, customers, suppliers"
            className="h-12 w-full bg-transparent text-sm text-ink placeholder:text-subtle focus:outline-none"
          />
          <kbd className="hidden shrink-0 rounded border border-line px-1.5 py-0.5 text-[11px] text-subtle sm:block">
            Esc
          </kbd>
        </div>

        <div className="scrollbar-thin max-h-[48vh] overflow-y-auto p-2">
          {hits.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-muted">
              Nothing matched “{query}”.
            </p>
          ) : (
            hits.map((hit, index) => {
              const showGroup = index === 0 || hits[index - 1].group !== hit.group;
              const Icon = hit.icon;
              const selected = cursor === index;
              return (
                <div key={hit.id}>
                  {showGroup ? (
                    <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
                      {hit.group}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => {
                      router.push(hit.href);
                      onClose();
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                      selected ? "bg-brand-soft" : "hover:bg-surface-2",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        selected ? "text-brand" : "text-subtle",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">
                        {hit.title}
                      </span>
                      <span className="block truncate text-[12px] text-subtle">
                        {hit.caption}
                      </span>
                    </span>
                    {selected ? (
                      <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-brand" />
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-subtle/50" />
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
