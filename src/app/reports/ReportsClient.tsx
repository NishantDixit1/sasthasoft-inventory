"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";

import { BarList } from "@/components/charts/BarList";
import { TrendChart } from "@/components/charts/TrendChart";
import { HealthBadge, ItemCell, PartyCell } from "@/components/domain/Indicators";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Segmented } from "@/components/ui/Segmented";
import { date, money, moneyCompact, number, percent } from "@/lib/format";
import { useLookups, useStock } from "@/lib/hooks";
import { purchaseTotal, salesTotal } from "@/lib/seed";
import {
  categoryBreakdown,
  inRange,
  lastNDays,
  rollupByCustomer,
  rollupBySupplier,
  rollupPurchases,
  rollupSales,
  topItems,
  tradeSeries,
} from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { useQueryState } from "@/lib/useQueryState";
import { daysBetween, downloadCsv, todayISO } from "@/lib/utils";
import type { ItemStock } from "@/lib/types";

type Tab = "stock" | "sales" | "purchase";

const TABS = [
  { value: "stock", label: "Stock report" },
  { value: "sales", label: "Sales report" },
  { value: "purchase", label: "Purchase report" },
] as const;

const RANGES = [
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "180 days" },
] as const;

export function ReportsClient() {
  const [tab, setTab] = useQueryState("tab", "stock");
  const [days, setDays] = useState<"30" | "90" | "180">("90");

  const range = useMemo(() => lastNDays(Number(days)), [days]);

  return (
    <>
      <PageHeader
        title="Reports"
        description={`Stock valuation, sales and purchase performance between ${date(range.from)} and ${date(range.to)}.`}
        actions={
          <Segmented options={[...RANGES]} value={days} onChange={setDays} />
        }
      />

      <div className="mb-4">
        <Segmented options={[...TABS]} value={tab as Tab} onChange={setTab} />
      </div>

      {tab === "stock" ? <StockReport /> : null}
      {tab === "sales" ? <SalesReport from={range.from} to={range.to} /> : null}
      {tab === "purchase" ? <PurchaseReport from={range.from} to={range.to} /> : null}
    </>
  );
}

/* ------------------------------ summary tiles ----------------------------- */

function Summary({
  rows,
}: {
  rows: { label: string; value: string; tone?: "success" | "danger" | "muted" }[];
}) {
  return (
    <div className="mb-4 grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
      {rows.map((row) => (
        <div key={row.label} className="bg-surface px-5 py-4">
          <p className="text-[12.5px] text-muted">{row.label}</p>
          <p
            className={`mt-1.5 text-[20px] font-semibold tracking-[-0.01em] tnum ${
              row.tone === "success"
                ? "text-success"
                : row.tone === "danger"
                  ? "text-danger"
                  : "text-ink"
            }`}
          >
            {row.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      size="sm"
      variant="secondary"
      icon={<Download className="h-3.5 w-3.5" />}
      onClick={onClick}
    >
      Export CSV
    </Button>
  );
}

/* ------------------------------ stock report ------------------------------ */

function StockReport() {
  const categories = useApp((state) => state.categories);
  const stock = useStock();

  const totalValue = stock.reduce((total, row) => total + Math.max(0, row.value), 0);
  const totalUnits = stock.reduce((total, row) => total + Math.max(0, row.onHand), 0);
  const lowCount = stock.filter((row) =>
    ["out", "critical", "low"].includes(row.health),
  ).length;

  /** nothing has moved in or out for two months */
  const today = todayISO();
  const dead = stock.filter(
    (row) =>
      row.onHand > 0 &&
      row.lastMovementAt &&
      daysBetween(row.lastMovementAt.slice(0, 10), today) > 60,
  );

  const breakdown = categoryBreakdown(categories, stock);

  const columns: Column<ItemStock>[] = [
    {
      key: "item",
      header: "Item",
      sort: (a, b) => a.item.name.localeCompare(b.item.name),
      cell: (row) => <ItemCell name={row.item.name} sku={row.item.sku} brand={row.item.brand} />,
    },
    {
      key: "category",
      header: "Category",
      className: "hidden lg:table-cell",
      headerClassName: "hidden lg:table-cell",
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
        <span className="text-[13px] text-ink tnum">
          {number(row.onHand)} {row.item.unit}
        </span>
      ),
    },
    {
      key: "min",
      header: "Minimum",
      align: "right",
      cell: (row) => (
        <span className="text-[13px] text-muted tnum">{number(row.item.minLevel)}</span>
      ),
    },
    {
      key: "cost",
      header: "Cost",
      align: "right",
      cell: (row) => (
        <span className="text-[13px] text-muted tnum">
          {money(row.item.costPrice, { decimals: true })}
        </span>
      ),
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
    {
      key: "health",
      header: "Status",
      sort: (a, b) => a.health.localeCompare(b.health),
      cell: (row) => <HealthBadge health={row.health} />,
    },
  ];

  return (
    <>
      <Summary
        rows={[
          { label: "Closing stock value", value: money(totalValue) },
          { label: "Units on hand", value: number(totalUnits) },
          { label: "Items below minimum", value: String(lowCount), tone: lowCount ? "danger" : "success" },
          { label: "Not moved in 60 days", value: String(dead.length), tone: "muted" },
        ]}
      />

      <Card className="mb-4">
        <CardHeader title="Value by category" subtitle="Closing stock valued at cost" />
        <CardBody>
          <BarList
            rows={breakdown.map((row) => ({
              key: row.category.id,
              label: row.category.name,
              caption: `${number(row.units)} units · ${row.skus} SKUs`,
              value: row.value,
              display: moneyCompact(row.value),
            }))}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Stock valuation"
          subtitle="Every item with its closing quantity and value"
          action={
            <ExportButton
              onClick={() =>
                downloadCsv("stock-report.csv", [
                  ["SKU", "Item", "Brand", "Category", "On hand", "Unit", "Minimum", "Cost", "Value", "Status"],
                  ...stock.map((row) => [
                    row.item.sku,
                    row.item.name,
                    row.item.brand,
                    categories.find((c) => c.id === row.item.categoryId)?.name ?? "",
                    row.onHand,
                    row.item.unit,
                    row.item.minLevel,
                    (row.item.costPrice / 100).toFixed(2),
                    (row.value / 100).toFixed(2),
                    row.health,
                  ]),
                ])
              }
            />
          }
        />
        <DataTable
          rows={stock}
          columns={columns}
          rowKey={(row) => row.item.id}
          initialSort={{ key: "value", direction: "desc" }}
          pageSize={12}
        />
      </Card>
    </>
  );
}

/* ------------------------------ sales report ------------------------------ */

function SalesReport({ from, to }: { from: string; to: string }) {
  const salesOrders = useApp((state) => state.salesOrders);
  const purchaseOrders = useApp((state) => state.purchaseOrders);
  const customers = useApp((state) => state.customers);
  const { items } = useLookups();

  const scoped = useMemo(
    () =>
      salesOrders.filter(
        (order) => order.status !== "cancelled" && inRange(order.date, { from, to }),
      ),
    [salesOrders, from, to],
  );

  const rollup = useMemo(() => rollupSales(scoped, items), [scoped, items]);
  const byCustomer = useMemo(
    () => rollupByCustomer(scoped, customers).filter((row) => row.orders > 0),
    [scoped, customers],
  );
  const ranked = useMemo(() => topItems(scoped, items, 8), [scoped, items]);
  const series = useMemo(
    () => tradeSeries(salesOrders, purchaseOrders, daysBetween(from, to) + 1, 12),
    [salesOrders, purchaseOrders, from, to],
  );

  const marginPct = rollup.revenue > 0 ? (rollup.margin / rollup.revenue) * 100 : 0;

  return (
    <>
      <Summary
        rows={[
          { label: "Net revenue", value: money(rollup.revenue) },
          { label: "Gross margin", value: `${money(rollup.margin)} (${percent(marginPct)})`, tone: "success" },
          { label: "Payments received", value: money(rollup.received) },
          { label: "Outstanding", value: money(rollup.outstanding), tone: rollup.outstanding ? "danger" : "success" },
        ]}
      />

      <Card className="mb-4">
        <CardHeader
          title="Trading over the period"
          subtitle="Sales against purchases, by period"
        />
        <CardBody className="pt-4">
          <TrendChart data={series} />
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader title="Best selling items" subtitle="Ranked by net revenue" />
          <CardBody>
            <BarList
              rows={ranked.map((row) => ({
                key: row.item.id,
                label: row.item.name,
                caption: `${number(row.units)} ${row.item.unit}`,
                value: row.revenue,
                display: moneyCompact(row.revenue),
              }))}
            />
          </CardBody>
        </Card>

        <Card className="xl:col-span-7">
          <CardHeader
            title="Sales by customer"
            subtitle={`${rollup.orders} orders, ${number(rollup.units)} units`}
            action={
              <ExportButton
                onClick={() =>
                  downloadCsv("sales-report.csv", [
                    ["Order", "Date", "Customer", "Godown", "Status", "Payment", "Total"],
                    ...scoped.map((order) => [
                      order.number,
                      order.date,
                      customers.find((c) => c.id === order.customerId)?.name ?? "",
                      order.godownId,
                      order.status,
                      order.paymentStatus,
                      (salesTotal(order) / 100).toFixed(2),
                    ]),
                  ])
                }
              />
            }
          />
          <DataTable
            rows={byCustomer}
            columns={[
              {
                key: "customer",
                header: "Customer",
                sort: (a, b) => a.party.name.localeCompare(b.party.name),
                cell: (row) => <PartyCell name={row.party.name} caption={row.party.city} />,
              },
              {
                key: "orders",
                header: "Orders",
                align: "right",
                sort: (a, b) => a.orders - b.orders,
                cell: (row) => <span className="text-[13px] text-muted tnum">{row.orders}</span>,
              },
              {
                key: "value",
                header: "Value",
                align: "right",
                sort: (a, b) => a.value - b.value,
                cell: (row) => (
                  <span className="text-[13.5px] font-medium text-ink tnum">
                    {money(row.value)}
                  </span>
                ),
              },
              {
                key: "outstanding",
                header: "Outstanding",
                align: "right",
                sort: (a, b) => a.outstanding - b.outstanding,
                cell: (row) => (
                  <span
                    className={`text-[13px] tnum ${row.outstanding > 0 ? "text-danger" : "text-subtle"}`}
                  >
                    {row.outstanding > 0 ? money(row.outstanding) : "—"}
                  </span>
                ),
              },
            ]}
            rowKey={(row) => row.party.id}
            initialSort={{ key: "value", direction: "desc" }}
            pageSize={8}
            dense
          />
        </Card>
      </div>
    </>
  );
}

/* ---------------------------- purchase report ----------------------------- */

function PurchaseReport({ from, to }: { from: string; to: string }) {
  const purchaseOrders = useApp((state) => state.purchaseOrders);
  const suppliers = useApp((state) => state.suppliers);
  const { items } = useLookups();

  const scoped = useMemo(
    () =>
      purchaseOrders.filter(
        (order) => order.status !== "cancelled" && inRange(order.date, { from, to }),
      ),
    [purchaseOrders, from, to],
  );

  const rollup = useMemo(() => rollupPurchases(scoped), [scoped]);
  const bySupplier = useMemo(
    () => rollupBySupplier(scoped, suppliers).filter((row) => row.orders > 0),
    [scoped, suppliers],
  );

  const byItem = useMemo(() => {
    const totals = new Map<string, { name: string; sku: string; qty: number; value: number }>();
    for (const order of scoped) {
      for (const line of order.lines) {
        const item = items[line.itemId];
        if (!item) continue;
        const entry = totals.get(item.id) ?? {
          name: item.name,
          sku: item.sku,
          qty: 0,
          value: 0,
        };
        entry.qty += line.qty;
        entry.value += line.qty * line.rate;
        totals.set(item.id, entry);
      }
    }
    return [...totals.values()].sort((a, b) => b.value - a.value).slice(0, 8);
  }, [scoped, items]);

  const fillRate = rollup.units > 0 ? (rollup.received / rollup.units) * 100 : 0;

  return (
    <>
      <Summary
        rows={[
          { label: "Purchase value", value: money(rollup.value) },
          { label: "Units ordered", value: number(rollup.units) },
          { label: "Received", value: `${number(rollup.received)} (${percent(fillRate, 0)})`, tone: "success" },
          { label: "Payable", value: money(rollup.outstanding), tone: rollup.outstanding ? "danger" : "success" },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader title="Most purchased items" subtitle="Ranked by purchase value" />
          <CardBody>
            <BarList
              tone="info"
              rows={byItem.map((row) => ({
                key: row.sku,
                label: row.name,
                caption: `${number(row.qty)} units`,
                value: row.value,
                display: moneyCompact(row.value),
              }))}
            />
          </CardBody>
        </Card>

        <Card className="xl:col-span-7">
          <CardHeader
            title="Purchases by supplier"
            subtitle={`${rollup.orders} orders in the period`}
            action={
              <ExportButton
                onClick={() =>
                  downloadCsv("purchase-report.csv", [
                    ["Order", "Date", "Supplier", "Expected", "Status", "Payment", "Total"],
                    ...scoped.map((order) => [
                      order.number,
                      order.date,
                      suppliers.find((s) => s.id === order.supplierId)?.name ?? "",
                      order.expectedDate,
                      order.status,
                      order.paymentStatus,
                      (purchaseTotal(order) / 100).toFixed(2),
                    ]),
                  ])
                }
              />
            }
          />
          <DataTable
            rows={bySupplier}
            columns={[
              {
                key: "supplier",
                header: "Supplier",
                sort: (a, b) => a.party.name.localeCompare(b.party.name),
                cell: (row) => (
                  <PartyCell tone="info" name={row.party.name} caption={row.party.city} />
                ),
              },
              {
                key: "orders",
                header: "Orders",
                align: "right",
                sort: (a, b) => a.orders - b.orders,
                cell: (row) => <span className="text-[13px] text-muted tnum">{row.orders}</span>,
              },
              {
                key: "lead",
                header: "Lead time",
                align: "right",
                className: "hidden sm:table-cell",
                headerClassName: "hidden sm:table-cell",
                cell: (row) => (
                  <span className="text-[13px] text-muted tnum">
                    {row.party.leadTimeDays} days
                  </span>
                ),
              },
              {
                key: "value",
                header: "Value",
                align: "right",
                sort: (a, b) => a.value - b.value,
                cell: (row) => (
                  <span className="text-[13.5px] font-medium text-ink tnum">
                    {money(row.value)}
                  </span>
                ),
              },
              {
                key: "outstanding",
                header: "Payable",
                align: "right",
                sort: (a, b) => a.outstanding - b.outstanding,
                cell: (row) => (
                  <span
                    className={`text-[13px] tnum ${row.outstanding > 0 ? "text-danger" : "text-subtle"}`}
                  >
                    {row.outstanding > 0 ? money(row.outstanding) : "—"}
                  </span>
                ),
              },
            ]}
            rowKey={(row) => row.party.id}
            initialSort={{ key: "value", direction: "desc" }}
            pageSize={8}
            dense
          />
        </Card>
      </div>
    </>
  );
}
