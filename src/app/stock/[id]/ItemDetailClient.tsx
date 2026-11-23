"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Boxes, ShoppingCart, SlidersHorizontal, TrendingUp } from "lucide-react";

import { HealthBadge, StockLevelBar } from "@/components/domain/Indicators";
import { MetaGrid } from "@/components/domain/MetaGrid";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdjustStockModal } from "@/components/modals/AdjustStockModal";
import { NewPurchaseModal } from "@/components/modals/NewPurchaseModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { FilterSelect } from "@/components/ui/Toolbar";
import { dateTime, money, number, titleCase } from "@/lib/format";
import { useLookups, useStock } from "@/lib/hooks";
import { itemLedger, stockForItem, type LedgerRow } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

const MOVEMENT_TONES: Record<string, string> = {
  opening: "neutral",
  purchase: "success",
  sale: "brand",
  adjustment: "warning",
  "transfer-in": "info",
  "transfer-out": "info",
};

export function ItemDetailClient({ id }: { id: string }) {
  const movements = useApp((state) => state.movements);
  const categories = useApp((state) => state.categories);
  const godowns = useApp((state) => state.godowns);
  const stock = useStock();
  const { suppliers } = useLookups();

  const [godownFilter, setGodownFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);

  const row = stockForItem(stock, id);

  const ledger = useMemo(
    () =>
      itemLedger(movements, id, godownFilter === "all" ? undefined : godownFilter)
        .slice()
        .reverse(),
    [movements, id, godownFilter],
  );

  const visibleLedger = useMemo(
    () => (typeFilter === "all" ? ledger : ledger.filter((entry) => entry.type === typeFilter)),
    [ledger, typeFilter],
  );

  if (!row) {
    return (
      <EmptyState
        icon={<Boxes className="h-5 w-5" />}
        title="That item could not be found"
        description="It may have been removed since this link was created."
        action={
          <Link href="/stock" className="text-[13px] font-medium text-brand">
            Back to stock
          </Link>
        }
      />
    );
  }

  const { item } = row;
  const margin = item.sellPrice - item.costPrice;
  const marginPct = item.sellPrice > 0 ? (margin / item.sellPrice) * 100 : 0;

  const columns: Column<LedgerRow>[] = [
    {
      key: "at",
      header: "When",
      sort: (a, b) => a.at.localeCompare(b.at),
      cell: (entry) => (
        <div>
          <p className="text-[13px] text-ink">{dateTime(entry.at)}</p>
          <p className="mt-0.5 text-[11.5px] text-subtle">{entry.actor}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Movement",
      cell: (entry) => (
        <Badge
          tone={
            (MOVEMENT_TONES[entry.type] ?? "neutral") as
              | "neutral"
              | "brand"
              | "success"
              | "warning"
              | "info"
          }
        >
          {titleCase(entry.type)}
        </Badge>
      ),
    },
    {
      key: "ref",
      header: "Reference",
      cell: (entry) => (
        <div>
          <p className="font-mono text-[12.5px] text-ink">{entry.refNumber}</p>
          {entry.note ? (
            <p className="mt-0.5 max-w-[260px] truncate text-[11.5px] text-subtle">
              {entry.note}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "godown",
      header: "Godown",
      className: "hidden lg:table-cell",
      headerClassName: "hidden lg:table-cell",
      cell: (entry) => (
        <span className="text-[13px] text-muted">
          {godowns.find((godown) => godown.id === entry.godownId)?.name}
        </span>
      ),
    },
    {
      key: "qty",
      header: "In / out",
      align: "right",
      sort: (a, b) => a.qty - b.qty,
      cell: (entry) => (
        <span
          className={cn(
            "text-[13.5px] font-medium tnum",
            entry.qty >= 0 ? "text-success" : "text-danger",
          )}
        >
          {entry.qty > 0 ? "+" : ""}
          {number(entry.qty)}
        </span>
      ),
    },
    {
      key: "balance",
      header: godownFilter === "all" ? "Balance" : "Godown balance",
      align: "right",
      cell: (entry) => (
        <span className="text-[13px] text-muted tnum">{number(entry.balance)}</span>
      ),
    },
  ];

  return (
    <>
      <Link
        href="/stock"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to stock
      </Link>

      <PageHeader
        title={item.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12.5px]">{item.sku}</span>
            <span className="text-subtle">·</span>
            <span>{item.brand}</span>
            <span className="text-subtle">·</span>
            <span>{categories.find((c) => c.id === item.categoryId)?.name}</span>
            <HealthBadge health={row.health} />
          </span>
        }
        actions={
          <>
            <Button
              variant="secondary"
              icon={<ShoppingCart className="h-4 w-4" />}
              onClick={() => setReorderOpen(true)}
            >
              Reorder {number(item.reorderQty)}
            </Button>
            <Button
              variant="primary"
              icon={<SlidersHorizontal className="h-4 w-4" />}
              onClick={() => setAdjustOpen(true)}
            >
              Adjust stock
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="On hand"
          value={`${number(row.onHand)} ${item.unit}`}
          sub={`Minimum level ${number(item.minLevel)}`}
          icon={<Boxes className="h-4 w-4" />}
          accent={row.health === "healthy" || row.health === "excess" ? "success" : "danger"}
          footer={
            <StockLevelBar
              onHand={row.onHand}
              minLevel={item.minLevel}
              health={row.health}
            />
          }
        />
        <StatCard
          label="Available to promise"
          value={number(Math.max(0, row.available))}
          sub={
            row.available < 0
              ? `Short by ${number(-row.available)} for orders already confirmed`
              : `${number(row.committed)} committed to open orders`
          }
          icon={<TrendingUp className="h-4 w-4" />}
          accent={row.available < 0 ? "danger" : "info"}
        />
        <StatCard
          label="Incoming"
          value={number(row.incoming)}
          sub="On purchase orders not yet received"
          icon={<ShoppingCart className="h-4 w-4" />}
          accent="warning"
        />
        <StatCard
          label="Stock value"
          value={money(row.value)}
          sub={`At ${money(item.costPrice, { decimals: true })} cost`}
          icon={<Boxes className="h-4 w-4" />}
          accent="brand"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-4">
          <CardHeader title="Item details" />
          <CardBody>
            <MetaGrid
              rows={[
                { label: "Unit", value: item.unit },
                { label: "HSN code", value: item.hsn },
                { label: "Cost price", value: money(item.costPrice, { decimals: true }) },
                { label: "Selling price", value: money(item.sellPrice, { decimals: true }) },
                {
                  label: "Margin",
                  value: (
                    <span className="text-success">
                      {money(margin, { decimals: true })} ({marginPct.toFixed(1)}%)
                    </span>
                  ),
                },
                { label: "Reorder quantity", value: number(item.reorderQty) },
              ]}
            />
            <p className="mt-4 text-[11.5px] font-medium uppercase tracking-[0.04em] text-subtle">
              Preferred supplier
            </p>
            <Link
              href={`/suppliers?focus=${item.preferredSupplierId}`}
              className="mt-1.5 block text-[13.5px] font-medium text-brand hover:underline"
            >
              {suppliers[item.preferredSupplierId]?.name}
            </Link>
            <p className="mt-0.5 text-[12px] text-subtle">
              {suppliers[item.preferredSupplierId]?.leadTimeDays} day lead time
            </p>
          </CardBody>
        </Card>

        <Card className="xl:col-span-8">
          <CardHeader
            title="Where this stock sits"
            subtitle="Quantity held in each godown"
          />
          <CardBody className="space-y-4">
            {godowns.map((godown) => {
              const qty = row.byGodown[godown.id] ?? 0;
              const share = row.onHand > 0 ? (qty / row.onHand) * 100 : 0;
              return (
                <div key={godown.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[13.5px] font-medium text-ink">
                      {godown.name}
                      <span className="ml-2 font-mono text-[11.5px] text-subtle">
                        {godown.code}
                      </span>
                    </p>
                    <p className="text-[13px] text-muted tnum">
                      {number(qty)} {item.unit}
                      <span className="ml-2 text-subtle">{share.toFixed(0)}%</span>
                    </p>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full bg-brand transition-[width] duration-500"
                      style={{ width: `${Math.max(qty > 0 ? 2 : 0, share)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Stock history"
          subtitle="Every movement against this item, newest first, with the running balance"
          action={
            <div className="flex flex-wrap gap-2">
              <FilterSelect
                label="Godown"
                value={godownFilter}
                onChange={setGodownFilter}
                options={godowns.map((godown) => ({
                  value: godown.id,
                  label: godown.name,
                }))}
              />
              <FilterSelect
                label="Type"
                value={typeFilter}
                onChange={setTypeFilter}
                options={[
                  { value: "purchase", label: "Purchase" },
                  { value: "sale", label: "Sale" },
                  { value: "adjustment", label: "Adjustment" },
                  { value: "transfer-in", label: "Transfer in" },
                  { value: "transfer-out", label: "Transfer out" },
                  { value: "opening", label: "Opening" },
                ]}
              />
            </div>
          }
        />
        <DataTable
          rows={visibleLedger}
          columns={columns}
          rowKey={(entry) => entry.id}
          pageSize={10}
          dense
          empty={
            <EmptyState
              title="No movements match these filters"
              description="Try a different godown or movement type."
            />
          }
        />
      </Card>

      {adjustOpen ? (
        <AdjustStockModal onClose={() => setAdjustOpen(false)} itemId={item.id} />
      ) : null}
      {reorderOpen ? (
        <NewPurchaseModal onClose={() => setReorderOpen(false)} seedItemId={item.id} />
      ) : null}
    </>
  );
}
