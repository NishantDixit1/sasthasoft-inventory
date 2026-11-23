"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Boxes, SlidersHorizontal, TriangleAlert, Layers } from "lucide-react";

import { HealthBadge, ItemCell, StockLevelBar } from "@/components/domain/Indicators";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdjustStockModal } from "@/components/modals/AdjustStockModal";
import { TransferModal } from "@/components/modals/TransferModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { FilterSelect, Toolbar } from "@/components/ui/Toolbar";
import { money, moneyCompact, number } from "@/lib/format";
import { useStock } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import { useQueryState } from "@/lib/useQueryState";
import type { ItemStock } from "@/lib/types";

const LOW = new Set(["out", "critical", "low"]);

export function StockClient() {
  const router = useRouter();

  const categories = useApp((state) => state.categories);
  const godowns = useApp((state) => state.godowns);
  const stock = useStock();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [godownId, setGodownId] = useState("all");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const [health, setHealth] = useQueryState("health", "all");

  /** when a godown is selected the table reports that godown's quantities */
  const scoped = useMemo(
    () =>
      stock.map((row) =>
        godownId === "all"
          ? row
          : { ...row, onHand: row.byGodown[godownId] ?? 0, value: (row.byGodown[godownId] ?? 0) * row.item.costPrice },
      ),
    [stock, godownId],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return scoped.filter((row) => {
      const matches =
        !needle ||
        row.item.name.toLowerCase().includes(needle) ||
        row.item.sku.toLowerCase().includes(needle) ||
        row.item.brand.toLowerCase().includes(needle);
      const healthMatch =
        health === "all" ||
        (health === "low" ? LOW.has(row.health) : row.health === health);
      return (
        matches &&
        healthMatch &&
        (category === "all" || row.item.categoryId === category)
      );
    });
  }, [scoped, query, category, health]);

  const summary = useMemo(
    () => ({
      value: stock.reduce((total, row) => total + Math.max(0, row.value), 0),
      units: stock.reduce((total, row) => total + Math.max(0, row.onHand), 0),
      low: stock.filter((row) => LOW.has(row.health)).length,
      committed: stock.reduce((total, row) => total + row.committed, 0),
    }),
    [stock],
  );

  const columns: Column<ItemStock>[] = [
    {
      key: "item",
      header: "Item",
      sort: (a, b) => a.item.name.localeCompare(b.item.name),
      cell: (row) => (
        <ItemCell name={row.item.name} sku={row.item.sku} brand={row.item.brand} />
      ),
    },
    {
      key: "category",
      header: "Category",
      className: "hidden xl:table-cell",
      headerClassName: "hidden xl:table-cell",
      sort: (a, b) => a.item.categoryId.localeCompare(b.item.categoryId),
      cell: (row) => (
        <span className="text-[13px] text-muted">
          {categories.find((c) => c.id === row.item.categoryId)?.name}
        </span>
      ),
    },
    {
      key: "onHand",
      header: "On hand",
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
      key: "committed",
      header: "Committed",
      align: "right",
      className: "hidden lg:table-cell",
      headerClassName: "hidden lg:table-cell",
      sort: (a, b) => a.committed - b.committed,
      cell: (row) => (
        <span className="text-[13px] text-muted tnum">
          {row.committed > 0 ? number(row.committed) : "—"}
        </span>
      ),
    },
    {
      key: "incoming",
      header: "Incoming",
      align: "right",
      className: "hidden lg:table-cell",
      headerClassName: "hidden lg:table-cell",
      sort: (a, b) => a.incoming - b.incoming,
      cell: (row) => (
        <span className="text-[13px] tnum">
          {row.incoming > 0 ? (
            <span className="text-info">+{number(row.incoming)}</span>
          ) : (
            <span className="text-subtle">—</span>
          )}
        </span>
      ),
    },
    {
      key: "level",
      header: "Level",
      sort: (a, b) => a.onHand / Math.max(1, a.item.minLevel) - b.onHand / Math.max(1, b.item.minLevel),
      cell: (row) => (
        <div className="w-32">
          <StockLevelBar
            onHand={row.onHand}
            minLevel={row.item.minLevel}
            health={row.health}
          />
          <p className="mt-1.5 text-[11.5px] text-subtle tnum">
            min {number(row.item.minLevel)}
          </p>
        </div>
      ),
    },
    {
      key: "health",
      header: "Status",
      sort: (a, b) => a.health.localeCompare(b.health),
      cell: (row) => <HealthBadge health={row.health} />,
    },
    {
      key: "value",
      header: "Value",
      align: "right",
      sort: (a, b) => a.value - b.value,
      cell: (row) => (
        <span className="text-[13.5px] font-medium text-ink tnum">{money(row.value)}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Stock"
        description="Every item, where it sits and how it got there. Quantities come from the movement ledger."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<ArrowLeftRight className="h-4 w-4" />}
              onClick={() => setTransferOpen(true)}
            >
              Transfer
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

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Stock value at cost"
          value={moneyCompact(summary.value)}
          sub={`${stock.length} SKUs tracked`}
          icon={<Boxes className="h-4 w-4" />}
          accent="brand"
        />
        <StatCard
          label="Units on hand"
          value={number(summary.units)}
          sub={`Across ${godowns.length} godowns`}
          icon={<Layers className="h-4 w-4" />}
          accent="info"
        />
        <StatCard
          label="Low stock alerts"
          value={summary.low}
          sub="At or below minimum level"
          icon={<TriangleAlert className="h-4 w-4" />}
          accent={summary.low > 0 ? "danger" : "success"}
        />
        <StatCard
          label="Committed to orders"
          value={number(summary.committed)}
          sub="On confirmed sales, not yet shipped"
          icon={<ArrowLeftRight className="h-4 w-4" />}
          accent="warning"
        />
      </div>

      <Card>
        <Toolbar
          query={query}
          onQueryChange={setQuery}
          placeholder="Search item name, SKU or brand"
          trailing={
            <p className="text-[12.5px] text-subtle tnum">
              {rows.length} of {stock.length} items
            </p>
          }
        >
          <FilterSelect
            label="Category"
            value={category}
            onChange={setCategory}
            options={categories.map((item) => ({ value: item.id, label: item.name }))}
          />
          <FilterSelect
            label="Status"
            value={health}
            onChange={setHealth}
            options={[
              { value: "low", label: "Needs attention" },
              { value: "out", label: "Out of stock" },
              { value: "critical", label: "Critical" },
              { value: "healthy", label: "In stock" },
              { value: "excess", label: "Overstocked" },
            ]}
          />
          <FilterSelect
            label="Godown"
            value={godownId}
            onChange={setGodownId}
            options={godowns.map((godown) => ({ value: godown.id, label: godown.name }))}
          />
        </Toolbar>

        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(row) => row.item.id}
          onRowClick={(row) => router.push(`/stock/${row.item.id}`)}
          initialSort={{ key: "level", direction: "asc" }}
          pageSize={12}
          empty={
            <EmptyState
              icon={<Boxes className="h-5 w-5" />}
              title="No items match these filters"
              description="Clear the search or pick a different category to see more."
            />
          }
        />
      </Card>

      {adjustOpen ? <AdjustStockModal onClose={() => setAdjustOpen(false)} /> : null}
      {transferOpen ? <TransferModal onClose={() => setTransferOpen(false)} /> : null}
    </>
  );
}
