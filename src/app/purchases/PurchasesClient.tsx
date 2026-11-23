"use client";

import { useMemo, useState } from "react";
import { Ban, PackageCheck, Plus, Truck, Wallet, Clock } from "lucide-react";

import {
  PartyCell,
  PaymentBadge,
  PurchaseStatusBadge,
} from "@/components/domain/Indicators";
import { LinesTable } from "@/components/domain/LinesTable";
import { MetaGrid, PaymentProgress, SectionTitle } from "@/components/domain/MetaGrid";
import { PageHeader } from "@/components/layout/PageHeader";
import { NewPurchaseModal } from "@/components/modals/NewPurchaseModal";
import { PaymentModal } from "@/components/modals/PaymentModal";
import { ReceiveGoodsModal } from "@/components/modals/ReceiveGoodsModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { FilterSelect, Toolbar } from "@/components/ui/Toolbar";
import { date, money, moneyCompact, number } from "@/lib/format";
import { useLookups } from "@/lib/hooks";
import { purchaseTotal } from "@/lib/seed";
import { inRange, lastNDays } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { useQueryState } from "@/lib/useQueryState";
import { daysBetween, todayISO } from "@/lib/utils";
import type { PurchaseOrder } from "@/lib/types";

const OPEN_STATUSES = new Set(["ordered", "partial"]);

export function PurchasesClient() {
  const purchaseOrders = useApp((state) => state.purchaseOrders);
  const cancelPurchase = useApp((state) => state.cancelPurchase);
  const recordPurchasePayment = useApp((state) => state.recordPurchasePayment);
  const { suppliers, godowns, items } = useLookups();

  const [query, setQuery] = useState("");
  const [payment, setPayment] = useState("all");
  const [newOpen, setNewOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const [status, setStatus] = useQueryState("status", "all");
  const [focusId, setFocusId] = useQueryState("focus");

  const focused = purchaseOrders.find((order) => order.id === focusId) ?? null;

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return purchaseOrders.filter((order) => {
      const supplier = suppliers[order.supplierId];
      const matches =
        !needle ||
        order.number.toLowerCase().includes(needle) ||
        (supplier?.name ?? "").toLowerCase().includes(needle) ||
        (supplier?.city ?? "").toLowerCase().includes(needle);
      const statusMatch =
        status === "all" ||
        (status === "open" ? OPEN_STATUSES.has(order.status) : order.status === status);
      return matches && statusMatch && (payment === "all" || order.paymentStatus === payment);
    });
  }, [purchaseOrders, suppliers, query, status, payment]);

  const summary = useMemo(() => {
    const range = lastNDays(30);
    const live = purchaseOrders.filter((order) => order.status !== "cancelled");
    const recent = live.filter((order) => inRange(order.date, range));
    const open = purchaseOrders.filter((order) => OPEN_STATUSES.has(order.status));
    return {
      spend: recent.reduce((total, order) => total + purchaseTotal(order), 0),
      orders: recent.length,
      payable: live.reduce(
        (total, order) => total + Math.max(0, purchaseTotal(order) - order.amountPaid),
        0,
      ),
      open: open.length,
      incomingUnits: open.reduce(
        (total, order) =>
          total +
          order.lines.reduce((sum, line) => sum + Math.max(0, line.qty - line.receivedQty), 0),
        0,
      ),
      received: purchaseOrders.filter((order) => order.status === "received").length,
    };
  }, [purchaseOrders]);

  const columns: Column<PurchaseOrder>[] = [
    {
      key: "number",
      header: "Order",
      sort: (a, b) => a.date.localeCompare(b.date),
      cell: (order) => (
        <div>
          <p className="font-mono text-[13px] font-medium text-ink">{order.number}</p>
          <p className="mt-0.5 text-[11.5px] text-subtle">{date(order.date)}</p>
        </div>
      ),
    },
    {
      key: "supplier",
      header: "Supplier",
      sort: (a, b) =>
        (suppliers[a.supplierId]?.name ?? "").localeCompare(suppliers[b.supplierId]?.name ?? ""),
      cell: (order) => (
        <PartyCell
          tone="info"
          name={suppliers[order.supplierId]?.name ?? "Unknown"}
          caption={suppliers[order.supplierId]?.city}
        />
      ),
    },
    {
      key: "godown",
      header: "Receive into",
      className: "hidden lg:table-cell",
      headerClassName: "hidden lg:table-cell",
      cell: (order) => (
        <span className="text-[13px] text-muted">{godowns[order.godownId]?.name}</span>
      ),
    },
    {
      key: "expected",
      header: "Expected",
      sort: (a, b) => a.expectedDate.localeCompare(b.expectedDate),
      cell: (order) => {
        const overdue =
          OPEN_STATUSES.has(order.status) && order.expectedDate < todayISO();
        return (
          <div>
            <p className="text-[13px] text-ink">{date(order.expectedDate)}</p>
            {overdue ? (
              <p className="mt-0.5 text-[11.5px] font-medium text-danger">
                {daysBetween(order.expectedDate, todayISO())} days late
              </p>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "progress",
      header: "Received",
      align: "right",
      cell: (order) => {
        const ordered = order.lines.reduce((total, line) => total + line.qty, 0);
        const received = order.lines.reduce((total, line) => total + line.receivedQty, 0);
        return (
          <span className="text-[13px] text-muted tnum">
            {number(received)} / {number(ordered)}
          </span>
        );
      },
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sort: (a, b) => purchaseTotal(a) - purchaseTotal(b),
      cell: (order) => (
        <span className="text-[13.5px] font-medium text-ink tnum">
          {money(purchaseTotal(order))}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sort: (a, b) => a.status.localeCompare(b.status),
      cell: (order) => <PurchaseStatusBadge status={order.status} />,
    },
    {
      key: "payment",
      header: "Payment",
      cell: (order) => <PaymentBadge status={order.paymentStatus} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Purchase"
        description="Purchase orders and goods receipts. Receiving against an order is what raises stock."
        actions={
          <Button
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setNewOpen(true)}
          >
            New purchase order
          </Button>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Spend, last 30 days"
          value={moneyCompact(summary.spend)}
          sub={`${summary.orders} orders`}
          icon={<Truck className="h-4 w-4" />}
          accent="info"
        />
        <StatCard
          label="Payables outstanding"
          value={moneyCompact(summary.payable)}
          sub="Owed to suppliers"
          icon={<Wallet className="h-4 w-4" />}
          accent="warning"
        />
        <StatCard
          label="Awaiting goods"
          value={summary.open}
          sub={`${number(summary.incomingUnits)} units still to arrive`}
          icon={<Clock className="h-4 w-4" />}
          accent="danger"
        />
        <StatCard
          label="Fully received"
          value={summary.received}
          sub="Stock already added"
          icon={<PackageCheck className="h-4 w-4" />}
          accent="success"
        />
      </div>

      <Card>
        <Toolbar
          query={query}
          onQueryChange={setQuery}
          placeholder="Search order number, supplier or city"
          trailing={
            <p className="text-[12.5px] text-subtle tnum">
              {rows.length} of {purchaseOrders.length} orders
            </p>
          }
        >
          <FilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "open", label: "Open (pending or part)" },
              { value: "ordered", label: "Pending" },
              { value: "partial", label: "Part received" },
              { value: "received", label: "Received" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
          <FilterSelect
            label="Payment"
            value={payment}
            onChange={setPayment}
            options={[
              { value: "unpaid", label: "Unpaid" },
              { value: "partial", label: "Part paid" },
              { value: "paid", label: "Paid" },
            ]}
          />
        </Toolbar>

        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(order) => order.id}
          onRowClick={(order) => setFocusId(order.id)}
          initialSort={{ key: "number", direction: "desc" }}
          pageSize={12}
          empty={
            <EmptyState
              icon={<Truck className="h-5 w-5" />}
              title="No purchase orders match these filters"
              description="Clear the search or pick a different status to see more."
            />
          }
        />
      </Card>

      <Drawer
        open={Boolean(focused)}
        onClose={() => setFocusId(null)}
        title={focused?.number ?? ""}
        subtitle={focused ? suppliers[focused.supplierId]?.name : undefined}
        badge={focused ? <PurchaseStatusBadge status={focused.status} /> : null}
        footer={
          focused ? (
            <>
              {focused.status === "ordered" ? (
                <Button
                  variant="ghost"
                  icon={<Ban className="h-3.5 w-3.5" />}
                  onClick={() => {
                    const result = cancelPurchase(focused.id);
                    if (!result.ok) toast.error("Could not cancel", result.error.message);
                    else toast.success(`${focused.number} cancelled`);
                  }}
                >
                  Cancel order
                </Button>
              ) : null}

              {purchaseTotal(focused) - focused.amountPaid > 0 &&
              focused.status !== "cancelled" ? (
                <Button variant="secondary" onClick={() => setPayOpen(true)}>
                  Record payment
                </Button>
              ) : null}

              {OPEN_STATUSES.has(focused.status) ? (
                <Button
                  variant="primary"
                  icon={<PackageCheck className="h-4 w-4" />}
                  onClick={() => setReceiveOpen(true)}
                >
                  Receive goods
                </Button>
              ) : null}
            </>
          ) : null
        }
      >
        {focused ? (
          <>
            <MetaGrid
              rows={[
                { label: "Order date", value: date(focused.date) },
                { label: "Expected", value: date(focused.expectedDate) },
                { label: "Receive into", value: godowns[focused.godownId]?.name ?? "" },
                {
                  label: "Contact",
                  value: suppliers[focused.supplierId]?.contactPerson ?? "",
                },
              ]}
            />

            <SectionTitle>Line items</SectionTitle>
            <LinesTable
              columns={[
                { key: "item", label: "Item" },
                { key: "ordered", label: "Ordered", align: "right" },
                { key: "received", label: "Received", align: "right" },
                { key: "amount", label: "Amount", align: "right" },
              ]}
            >
              {focused.lines.map((line) => {
                const item = items[line.itemId];
                const complete = line.receivedQty >= line.qty;
                return (
                  <tr key={line.itemId} className="border-b border-line/70 last:border-0">
                    <td className="px-3 py-2.5">
                      <p className="text-[13px] font-medium text-ink">{item?.name}</p>
                      <p className="font-mono text-[11px] text-subtle">{item?.sku}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px] text-muted tnum">
                      {number(line.qty)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px] tnum">
                      <span className={complete ? "text-success" : "text-warning"}>
                        {number(line.receivedQty)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px] font-medium text-ink tnum">
                      {money(line.qty * line.rate, { decimals: true })}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-surface-2/60">
                <td colSpan={3} className="px-3 py-2.5 text-right text-[13px] font-medium text-ink">
                  Total with GST
                </td>
                <td className="px-3 py-2.5 text-right text-[15px] font-semibold text-ink tnum">
                  {money(purchaseTotal(focused), { decimals: true })}
                </td>
              </tr>
            </LinesTable>

            <SectionTitle>Payment</SectionTitle>
            <PaymentProgress
              total={purchaseTotal(focused)}
              paid={focused.amountPaid}
              formatter={(value) => money(value, { decimals: true })}
            />

            {focused.notes ? (
              <>
                <SectionTitle>Notes</SectionTitle>
                <p className="rounded-xl border border-line bg-surface-2/50 p-4 text-[13px] leading-relaxed text-muted">
                  {focused.notes}
                </p>
              </>
            ) : null}

            {OPEN_STATUSES.has(focused.status) ? (
              <p className="mt-4 rounded-xl bg-warning-soft px-4 py-3 text-[12.5px] leading-relaxed text-warning">
                Nothing on this order has reached stock yet beyond what is shown as received.
                Receiving the goods adds the quantity to {godowns[focused.godownId]?.name} and
                writes a movement into the stock history.
              </p>
            ) : null}
          </>
        ) : null}
      </Drawer>

      {focused && receiveOpen ? (
        <ReceiveGoodsModal order={focused} onClose={() => setReceiveOpen(false)} />
      ) : null}

      {focused && payOpen ? (
        <PaymentModal
          onClose={() => setPayOpen(false)}
          title="Record supplier payment"
          reference={focused.number}
          total={purchaseTotal(focused)}
          alreadyPaid={focused.amountPaid}
          onSubmit={(amount) => recordPurchasePayment(focused.id, amount)}
        />
      ) : null}

      {newOpen ? <NewPurchaseModal onClose={() => setNewOpen(false)} /> : null}
    </>
  );
}
