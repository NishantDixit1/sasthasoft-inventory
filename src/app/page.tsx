"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Boxes,
  IndianRupee,
  Plus,
  ShoppingCart,
  TriangleAlert,
  Truck,
} from "lucide-react";

import { BarList } from "@/components/charts/BarList";
import { DonutChart } from "@/components/charts/DonutChart";
import { TrendChart } from "@/components/charts/TrendChart";
import { ActivityFeed } from "@/components/domain/ActivityFeed";
import { HealthBadge, ItemCell, StockLevelBar } from "@/components/domain/Indicators";
import { PageHeader } from "@/components/layout/PageHeader";
import { NewPurchaseModal } from "@/components/modals/NewPurchaseModal";
import { NewSaleModal } from "@/components/modals/NewSaleModal";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Segmented } from "@/components/ui/Segmented";
import { StatCard } from "@/components/ui/StatCard";
import { money, moneyCompact, number } from "@/lib/format";
import { useLookups, useLowStock, useStock } from "@/lib/hooks";
import { purchaseTotal, salesTotal } from "@/lib/seed";
import {
  categoryBreakdown,
  godownUsage,
  inRange,
  lastNDays,
  topItems,
  tradeSeries,
} from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { addDays } from "@/lib/utils";

const RANGES = [
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
] as const;

export default function DashboardPage() {
  const [days, setDays] = useState<"30" | "60" | "90">("30");
  const [saleOpen, setSaleOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [reorderItemId, setReorderItemId] = useState<string | undefined>();

  const salesOrders = useApp((state) => state.salesOrders);
  const purchaseOrders = useApp((state) => state.purchaseOrders);
  const activity = useApp((state) => state.activity);
  const categories = useApp((state) => state.categories);
  const godowns = useApp((state) => state.godowns);

  const stock = useStock();
  const alerts = useLowStock();
  const { items } = useLookups();

  const window = Number(days);
  const range = useMemo(() => lastNDays(window), [window]);
  const previous = useMemo(
    () => ({ from: addDays(range.from, -window), to: addDays(range.from, -1) }),
    [range, window],
  );

  const totals = useMemo(() => {
    const liveSales = salesOrders.filter((order) => order.status !== "cancelled");
    const livePurchases = purchaseOrders.filter((order) => order.status !== "cancelled");

    const revenue = (from: typeof range) =>
      liveSales
        .filter((order) => inRange(order.date, from))
        .reduce((sum, order) => sum + salesTotal(order), 0);
    const spend = (from: typeof range) =>
      livePurchases
        .filter((order) => inRange(order.date, from))
        .reduce((sum, order) => sum + purchaseTotal(order), 0);

    const revenueNow = revenue(range);
    const revenueBefore = revenue(previous);
    const spendNow = spend(range);
    const spendBefore = spend(previous);

    // Only compare against the previous period when there is a full period of
    // history behind it, otherwise the change is measured against a part empty
    // window and reads as implausible growth.
    const earliest = [...liveSales, ...livePurchases].reduce(
      (oldest, order) => (order.date < oldest ? order.date : oldest),
      range.to,
    );
    const comparable = previous.from >= earliest;

    return {
      revenueNow,
      spendNow,
      ordersNow: liveSales.filter((order) => inRange(order.date, range)).length,
      purchaseOrdersNow: livePurchases.filter((order) => inRange(order.date, range)).length,
      revenueDelta:
        comparable && revenueBefore
          ? ((revenueNow - revenueBefore) / revenueBefore) * 100
          : null,
      spendDelta:
        comparable && spendBefore ? ((spendNow - spendBefore) / spendBefore) * 100 : null,
      outstanding: liveSales.reduce(
        (sum, order) => sum + Math.max(0, salesTotal(order) - order.amountPaid),
        0,
      ),
      awaitingDelivery: salesOrders.filter((order) => order.status === "confirmed").length,
      awaitingGoods: purchaseOrders.filter(
        (order) => order.status === "ordered" || order.status === "partial",
      ).length,
    };
  }, [salesOrders, purchaseOrders, range, previous]);

  const inventoryValue = stock.reduce((sum, row) => sum + Math.max(0, row.value), 0);
  const unitsOnHand = stock.reduce((sum, row) => sum + Math.max(0, row.onHand), 0);
  const criticalCount = alerts.filter(
    (row) => row.health === "out" || row.health === "critical",
  ).length;

  const series = useMemo(
    () => tradeSeries(salesOrders, purchaseOrders, window, 12),
    [salesOrders, purchaseOrders, window],
  );

  const ranked = useMemo(
    () =>
      topItems(
        salesOrders.filter((order) => inRange(order.date, range)),
        items,
        5,
      ),
    [salesOrders, items, range],
  );

  const categoryRows = useMemo(
    () => categoryBreakdown(categories, stock),
    [categories, stock],
  );
  const godownRows = useMemo(() => godownUsage(godowns, stock), [godowns, stock]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Stock position, trading activity and anything that needs attention today."
        actions={
          <>
            <Segmented
              options={[...RANGES]}
              value={days}
              onChange={(value) => setDays(value)}
            />
            <Button
              variant="secondary"
              icon={<Truck className="h-4 w-4" />}
              onClick={() => {
                setReorderItemId(undefined);
                setPurchaseOpen(true);
              }}
            >
              New purchase
            </Button>
            <Button
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setSaleOpen(true)}
            >
              New sale
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Stock value"
          value={moneyCompact(inventoryValue)}
          sub={`${number(unitsOnHand)} units across ${stock.length} SKUs`}
          icon={<Boxes className="h-4 w-4" />}
          accent="brand"
        />
        <StatCard
          label={`Sales, last ${window} days`}
          value={moneyCompact(totals.revenueNow)}
          delta={totals.revenueDelta}
          sub={
            totals.revenueDelta === null
              ? `${totals.ordersNow} orders`
              : `${totals.ordersNow} orders vs previous ${window} days`
          }
          icon={<IndianRupee className="h-4 w-4" />}
          accent="success"
        />
        <StatCard
          label={`Purchases, last ${window} days`}
          value={moneyCompact(totals.spendNow)}
          delta={totals.spendDelta}
          sub={`${totals.purchaseOrdersNow} orders`}
          icon={<ShoppingCart className="h-4 w-4" />}
          accent="info"
        />
        <StatCard
          label="Low stock alerts"
          value={alerts.length}
          sub={
            criticalCount > 0
              ? `${criticalCount} critical or out of stock`
              : "Everything above its minimum"
          }
          icon={<TriangleAlert className="h-4 w-4" />}
          accent={alerts.length > 0 ? "danger" : "success"}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader
            title="Sales against purchases"
            subtitle={`Order value by period over the last ${window} days`}
            action={
              <div className="hidden items-center gap-4 sm:flex">
                <Figure label="Sales" value={money(totals.revenueNow)} tone="brand" />
                <Figure label="Purchases" value={money(totals.spendNow)} tone="info" />
              </div>
            }
          />
          <CardBody className="pt-4">
            <TrendChart data={series} />
          </CardBody>
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader title="Stock value by category" subtitle="Valued at cost price" />
          <CardBody>
            <DonutChart
              centerLabel="Total"
              centerValue={moneyCompact(inventoryValue)}
              slices={categoryRows.map((row) => ({
                key: row.category.id,
                label: row.category.name,
                value: row.value,
                display: moneyCompact(row.value),
              }))}
            />
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader
            title="Low stock alerts"
            subtitle="Items at or below their minimum level"
            action={
              <ButtonLink href="/stock?health=low" size="sm" variant="secondary">
                View stock
              </ButtonLink>
            }
          />
          {alerts.length === 0 ? (
            <EmptyState
              icon={<Boxes className="h-5 w-5" />}
              title="Every item is above its minimum level"
              description="Alerts appear here as soon as stock drops below the level set on the item."
            />
          ) : (
            <ul className="divide-y divide-line">
              {alerts.slice(0, 6).map((row) => (
                <li
                  key={row.item.id}
                  className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-surface-2/60"
                >
                  <Link href={`/stock/${row.item.id}`} className="min-w-0 flex-1">
                    <ItemCell name={row.item.name} sku={row.item.sku} brand={row.item.brand} />
                  </Link>

                  <div className="hidden w-32 shrink-0 sm:block">
                    <StockLevelBar
                      onHand={row.onHand}
                      minLevel={row.item.minLevel}
                      health={row.health}
                    />
                    <p className="mt-1.5 text-[11.5px] text-subtle tnum">
                      {row.onHand} of {row.item.minLevel} minimum
                    </p>
                  </div>

                  <div className="hidden shrink-0 md:block">
                    <HealthBadge health={row.health} />
                  </div>

                  <Button
                    size="sm"
                    variant="soft"
                    className="shrink-0"
                    onClick={() => {
                      setReorderItemId(row.item.id);
                      setPurchaseOpen(true);
                    }}
                  >
                    Reorder {row.item.reorderQty}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader
            title="Recent activity"
            subtitle="Every stock movement and order event"
          />
          <CardBody className="max-h-[420px] overflow-y-auto scrollbar-thin pt-2">
            <ActivityFeed events={activity.slice(0, 12)} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader
            title="Top selling items"
            subtitle={`By revenue over the last ${window} days`}
          />
          <CardBody>
            {ranked.length === 0 ? (
              <EmptyState title="No sales in this period" />
            ) : (
              <BarList
                rows={ranked.map((row) => ({
                  key: row.item.id,
                  label: row.item.name,
                  caption: `${number(row.units)} ${row.item.unit}`,
                  value: row.revenue,
                  display: moneyCompact(row.revenue),
                }))}
              />
            )}
          </CardBody>
        </Card>

        <Card className="xl:col-span-7">
          <CardHeader
            title="Godown utilisation"
            subtitle="Units held against capacity"
            action={
              <ButtonLink href="/godowns" size="sm" variant="secondary">
                Godown view
              </ButtonLink>
            }
          />
          <CardBody className="space-y-4">
            {godownRows.map((row) => (
              <div key={row.godown.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[13.5px] font-medium text-ink">
                    {row.godown.name}
                    <span className="ml-2 font-mono text-[11.5px] text-subtle">
                      {row.godown.code}
                    </span>
                  </p>
                  <p className="text-[13px] text-muted tnum">
                    {number(row.units)} / {number(row.godown.capacity)}
                  </p>
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full bg-brand transition-[width] duration-500"
                      style={{ width: `${Math.max(2, row.utilisation)}%` }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right text-[12px] text-subtle tnum">
                    {row.utilisation}% · {row.skus} SKUs
                  </span>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <FollowUp
          href="/sales?status=confirmed"
          label="Orders awaiting delivery"
          value={totals.awaitingDelivery}
          hint="Confirmed but not yet shipped"
        />
        <FollowUp
          href="/purchases?status=open"
          label="Purchases awaiting goods"
          value={totals.awaitingGoods}
          hint="Receiving these will raise stock"
        />
        <FollowUp
          href="/reports?tab=sales"
          label="Receivables outstanding"
          value={moneyCompact(totals.outstanding)}
          hint="Across all delivered orders"
        />
      </div>

      {saleOpen ? <NewSaleModal onClose={() => setSaleOpen(false)} /> : null}
      {purchaseOpen ? (
        <NewPurchaseModal
          onClose={() => setPurchaseOpen(false)}
          seedItemId={reorderItemId}
        />
      ) : null}
    </>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "brand" | "info";
}) {
  return (
    <div className="text-right">
      <p className="flex items-center justify-end gap-1.5 text-[11.5px] text-subtle">
        <span
          className={`h-2 w-2 rounded-full ${tone === "brand" ? "bg-brand" : "bg-info"}`}
        />
        {label}
      </p>
      <p className="text-[15px] font-semibold text-ink tnum">{value}</p>
    </div>
  );
}

function FollowUp({
  href,
  label,
  value,
  hint,
}: {
  href: string;
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-xs transition-all hover:border-line-strong hover:shadow-md"
    >
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-muted">{label}</span>
        <span className="mt-1 block text-[22px] font-semibold leading-none text-ink tnum">
          {value}
        </span>
        <span className="mt-1.5 block text-[12px] text-subtle">{hint}</span>
      </span>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand" />
    </Link>
  );
}
