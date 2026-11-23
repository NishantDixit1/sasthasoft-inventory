"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, ArrowRight, Store, Warehouse } from "lucide-react";

import { ItemCell } from "@/components/domain/Indicators";
import { PageHeader } from "@/components/layout/PageHeader";
import { TransferModal } from "@/components/modals/TransferModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Toolbar } from "@/components/ui/Toolbar";
import { date, money, moneyCompact, number } from "@/lib/format";
import { useStock } from "@/lib/hooks";
import { godownUsage } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import type { ItemStock } from "@/lib/types";
import { cn } from "@/lib/utils";

export function GodownsClient() {
  const godowns = useApp((state) => state.godowns);
  const transfers = useApp((state) => state.transfers);
  const items = useApp((state) => state.items);
  const stock = useStock();

  const [selected, setSelected] = useState<string>(godowns[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);

  const usage = useMemo(() => godownUsage(godowns, stock), [godowns, stock]);

  const held = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return stock
      .filter((row) => (row.byGodown[selected] ?? 0) !== 0)
      .filter(
        (row) =>
          !needle ||
          row.item.name.toLowerCase().includes(needle) ||
          row.item.sku.toLowerCase().includes(needle),
      )
      .map((row) => ({ ...row, onHand: row.byGodown[selected] ?? 0 }));
  }, [stock, selected, query]);

  const selectedGodown = godowns.find((godown) => godown.id === selected);
  const selectedUsage = usage.find((row) => row.godown.id === selected);

  const columns: Column<ItemStock>[] = [
    {
      key: "item",
      header: "Item",
      sort: (a, b) => a.item.name.localeCompare(b.item.name),
      cell: (row) => <ItemCell name={row.item.name} sku={row.item.sku} brand={row.item.brand} />,
    },
    {
      key: "qty",
      header: "Held here",
      align: "right",
      sort: (a, b) => a.onHand - b.onHand,
      cell: (row) => (
        <span className="text-[13.5px] font-medium text-ink tnum">
          {number(row.onHand)}{" "}
          <span className="text-[11.5px] font-normal text-subtle">{row.item.unit}</span>
        </span>
      ),
    },
    {
      key: "share",
      header: "Share of total stock",
      cell: (row) => {
        const total = Object.values(row.byGodown).reduce((sum, qty) => sum + qty, 0);
        const share = total > 0 ? (row.onHand / total) * 100 : 0;
        return (
          <div className="flex w-40 items-center gap-2.5">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${Math.max(2, share)}%` }}
              />
            </div>
            <span className="w-9 shrink-0 text-right text-[11.5px] text-subtle tnum">
              {share.toFixed(0)}%
            </span>
          </div>
        );
      },
    },
    {
      key: "value",
      header: "Value here",
      align: "right",
      sort: (a, b) => a.onHand * a.item.costPrice - b.onHand * b.item.costPrice,
      cell: (row) => (
        <span className="text-[13px] text-muted tnum">
          {money(row.onHand * row.item.costPrice)}
        </span>
      ),
    },
    {
      key: "link",
      header: "",
      align: "right",
      cell: (row) => (
        <Link
          href={`/stock/${row.item.id}`}
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand hover:underline"
        >
          History
          <ArrowRight className="h-3 w-3" />
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Godown view"
        description="Where stock is held, how full each location is and what has moved between them."
        actions={
          <Button
            variant="primary"
            icon={<ArrowLeftRight className="h-4 w-4" />}
            onClick={() => setTransferOpen(true)}
          >
            Transfer stock
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {usage.map((row) => {
          const active = row.godown.id === selected;
          const Icon = row.godown.kind === "store" ? Store : Warehouse;
          return (
            <button
              key={row.godown.id}
              type="button"
              onClick={() => setSelected(row.godown.id)}
              className={cn(
                "rounded-[var(--radius-card)] border bg-surface p-5 text-left shadow-xs transition-all",
                active
                  ? "border-brand ring-4 ring-[var(--brand-ring)]"
                  : "border-line hover:border-line-strong hover:shadow-md",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-ink">
                    {row.godown.name}
                  </p>
                  <p className="mt-0.5 font-mono text-[11.5px] text-subtle">
                    {row.godown.code} · {row.godown.city}
                  </p>
                </div>
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    active ? "bg-brand text-white" : "bg-surface-2 text-subtle",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
              </div>

              <p className="mt-3 text-[22px] font-semibold leading-none text-ink tnum">
                {moneyCompact(row.value)}
              </p>
              <p className="mt-1.5 text-[12px] text-subtle tnum">
                {number(row.units)} units · {row.skus} SKUs
              </p>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500",
                    row.utilisation > 85 ? "bg-warning" : "bg-brand",
                  )}
                  style={{ width: `${Math.max(2, row.utilisation)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11.5px] text-subtle tnum">
                {row.utilisation}% of {number(row.godown.capacity)} capacity
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader
            title={`Stock in ${selectedGodown?.name ?? ""}`}
            subtitle={
              selectedUsage
                ? `${number(selectedUsage.units)} units worth ${money(selectedUsage.value)}`
                : undefined
            }
          />
          <Toolbar
            query={query}
            onQueryChange={setQuery}
            placeholder="Search item or SKU in this godown"
            trailing={
              <p className="text-[12.5px] text-subtle tnum">{held.length} items</p>
            }
          />
          <DataTable
            rows={held}
            columns={columns}
            rowKey={(row) => row.item.id}
            initialSort={{ key: "value", direction: "desc" }}
            pageSize={10}
            dense
            empty={
              <EmptyState
                icon={<Warehouse className="h-5 w-5" />}
                title="Nothing is held in this godown"
                description="Receive a purchase order into it, or transfer stock in from another location."
              />
            }
          />
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader
            title="Stock transfers"
            subtitle="Movements between godowns"
          />
          {transfers.length === 0 ? (
            <EmptyState title="No transfers recorded yet" />
          ) : (
            <ul className="divide-y divide-line">
              {transfers.slice(0, 8).map((transfer) => {
                const from = godowns.find((g) => g.id === transfer.fromGodownId);
                const to = godowns.find((g) => g.id === transfer.toGodownId);
                const units = transfer.lines.reduce((total, line) => total + line.qty, 0);
                return (
                  <li key={transfer.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-[12.5px] font-medium text-ink">
                        {transfer.number}
                      </p>
                      <Badge tone="success">Completed</Badge>
                    </div>
                    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
                      <span className="truncate">{from?.code}</span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-subtle" />
                      <span className="truncate">{to?.code}</span>
                    </p>
                    <p className="mt-1 text-[11.5px] text-subtle tnum">
                      {date(transfer.date)} · {transfer.lines.length} items ·{" "}
                      {number(units)} units
                    </p>
                    <ul className="mt-2 space-y-0.5">
                      {transfer.lines.slice(0, 3).map((line) => (
                        <li key={line.itemId} className="truncate text-[11.5px] text-subtle">
                          {number(line.qty)} ×{" "}
                          {items.find((item) => item.id === line.itemId)?.name}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {transferOpen ? <TransferModal onClose={() => setTransferOpen(false)} /> : null}
    </>
  );
}
