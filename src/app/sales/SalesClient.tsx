"use client";

import { useMemo, useState } from "react";
import {
  Ban,
  IndianRupee,
  PackageCheck,
  Plus,
  ReceiptIndianRupee,
  ScrollText,
  Wallet,
} from "lucide-react";

import {
  ChannelBadge,
  PartyCell,
  PaymentBadge,
  SalesStatusBadge,
} from "@/components/domain/Indicators";
import { LinesTable } from "@/components/domain/LinesTable";
import { MetaGrid, PaymentProgress, SectionTitle } from "@/components/domain/MetaGrid";
import { PageHeader } from "@/components/layout/PageHeader";
import { NewSaleModal } from "@/components/modals/NewSaleModal";
import { PaymentModal } from "@/components/modals/PaymentModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { FilterSelect, Toolbar } from "@/components/ui/Toolbar";
import { date, money, moneyCompact, number } from "@/lib/format";
import { useLookups } from "@/lib/hooks";
import { salesLineNet, salesTotal } from "@/lib/seed";
import { inRange, lastNDays } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { useQueryState } from "@/lib/useQueryState";
import type { SalesOrder } from "@/lib/types";

export function SalesClient() {
  const salesOrders = useApp((state) => state.salesOrders);
  const deliverSale = useApp((state) => state.deliverSale);
  const cancelSale = useApp((state) => state.cancelSale);
  const recordSalePayment = useApp((state) => state.recordSalePayment);
  const { customers, godowns, items } = useLookups();

  const [query, setQuery] = useState("");
  const [payment, setPayment] = useState("all");
  const [channel, setChannel] = useState("all");
  const [newOpen, setNewOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  // the open record and the status filter live in the URL, so the dashboard
  // and the command palette can link straight to either
  const [status, setStatus] = useQueryState("status", "all");
  const [focusId, setFocusId] = useQueryState("focus");

  const focused = salesOrders.find((order) => order.id === focusId) ?? null;

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return salesOrders.filter((order) => {
      const customer = customers[order.customerId];
      const matches =
        !needle ||
        order.number.toLowerCase().includes(needle) ||
        (customer?.name ?? "").toLowerCase().includes(needle) ||
        (customer?.city ?? "").toLowerCase().includes(needle);
      return (
        matches &&
        (status === "all" || order.status === status) &&
        (payment === "all" || order.paymentStatus === payment) &&
        (channel === "all" || order.channel === channel)
      );
    });
  }, [salesOrders, customers, query, status, payment, channel]);

  const summary = useMemo(() => {
    const range = lastNDays(30);
    const live = salesOrders.filter((order) => order.status !== "cancelled");
    const recent = live.filter((order) => inRange(order.date, range));
    return {
      revenue: recent.reduce((total, order) => total + salesTotal(order), 0),
      orders: recent.length,
      outstanding: live.reduce(
        (total, order) => total + Math.max(0, salesTotal(order) - order.amountPaid),
        0,
      ),
      awaiting: salesOrders.filter((order) => order.status === "confirmed").length,
      delivered: salesOrders.filter((order) => order.status === "delivered").length,
    };
  }, [salesOrders]);

  const columns: Column<SalesOrder>[] = [
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
      key: "customer",
      header: "Customer",
      sort: (a, b) =>
        (customers[a.customerId]?.name ?? "").localeCompare(
          customers[b.customerId]?.name ?? "",
        ),
      cell: (order) => (
        <PartyCell
          name={customers[order.customerId]?.name ?? "Unknown"}
          caption={customers[order.customerId]?.city}
        />
      ),
    },
    {
      key: "godown",
      header: "Godown",
      className: "hidden lg:table-cell",
      headerClassName: "hidden lg:table-cell",
      cell: (order) => (
        <span className="text-[13px] text-muted">{godowns[order.godownId]?.name}</span>
      ),
    },
    {
      key: "items",
      header: "Items",
      align: "right",
      sort: (a, b) => a.lines.length - b.lines.length,
      cell: (order) => (
        <span className="text-[13px] text-muted tnum">
          {order.lines.length} line{order.lines.length > 1 ? "s" : ""}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sort: (a, b) => salesTotal(a) - salesTotal(b),
      cell: (order) => (
        <span className="text-[13.5px] font-medium text-ink tnum">
          {money(salesTotal(order))}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sort: (a, b) => a.status.localeCompare(b.status),
      cell: (order) => <SalesStatusBadge status={order.status} />,
    },
    {
      key: "payment",
      header: "Payment",
      sort: (a, b) => a.paymentStatus.localeCompare(b.paymentStatus),
      cell: (order) => <PaymentBadge status={order.paymentStatus} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Sales"
        description="Sales orders and invoices. Delivering an order is what releases the stock."
        actions={
          <Button
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setNewOpen(true)}
          >
            New sale
          </Button>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue, last 30 days"
          value={moneyCompact(summary.revenue)}
          sub={`${summary.orders} orders`}
          icon={<IndianRupee className="h-4 w-4" />}
          accent="success"
        />
        <StatCard
          label="Receivables outstanding"
          value={moneyCompact(summary.outstanding)}
          sub="Across all orders"
          icon={<Wallet className="h-4 w-4" />}
          accent="warning"
        />
        <StatCard
          label="Awaiting delivery"
          value={summary.awaiting}
          sub="Confirmed, stock not yet released"
          icon={<ScrollText className="h-4 w-4" />}
          accent="info"
        />
        <StatCard
          label="Delivered orders"
          value={summary.delivered}
          sub="Stock already released"
          icon={<PackageCheck className="h-4 w-4" />}
          accent="brand"
        />
      </div>

      <Card>
        <Toolbar
          query={query}
          onQueryChange={setQuery}
          placeholder="Search order number, customer or city"
          trailing={
            <p className="text-[12.5px] text-subtle tnum">
              {rows.length} of {salesOrders.length} orders
            </p>
          }
        >
          <FilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "draft", label: "Draft" },
              { value: "confirmed", label: "Confirmed" },
              { value: "delivered", label: "Delivered" },
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
          <FilterSelect
            label="Channel"
            value={channel}
            onChange={setChannel}
            options={[
              { value: "distributor", label: "Distributor" },
              { value: "retail", label: "Retail" },
              { value: "online", label: "Online" },
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
              icon={<ReceiptIndianRupee className="h-5 w-5" />}
              title="No orders match these filters"
              description="Clear the search or pick a different status to see more."
            />
          }
        />
      </Card>

      <Drawer
        open={Boolean(focused)}
        onClose={() => setFocusId(null)}
        title={focused?.number ?? ""}
        subtitle={focused ? customers[focused.customerId]?.name : undefined}
        badge={focused ? <SalesStatusBadge status={focused.status} /> : null}
        footer={
          focused ? (
            <>
              {focused.status !== "delivered" && focused.status !== "cancelled" ? (
                <Button
                  variant="ghost"
                  icon={<Ban className="h-3.5 w-3.5" />}
                  onClick={() => {
                    const result = cancelSale(focused.id);
                    if (!result.ok) toast.error("Could not cancel", result.error.message);
                    else toast.success(`${focused.number} cancelled`);
                  }}
                >
                  Cancel order
                </Button>
              ) : null}

              {focused.status === "delivered" &&
              salesTotal(focused) - focused.amountPaid > 0 ? (
                <Button variant="secondary" onClick={() => setPayOpen(true)}>
                  Record payment
                </Button>
              ) : null}

              {focused.status === "confirmed" || focused.status === "draft" ? (
                <Button
                  variant="primary"
                  icon={<PackageCheck className="h-4 w-4" />}
                  onClick={() => {
                    const result = deliverSale(focused.id);
                    if (!result.ok) {
                      toast.error("Could not deliver", result.error.message);
                      return;
                    }
                    toast.success(
                      `${focused.number} delivered`,
                      "Stock has been released from the godown.",
                    );
                  }}
                >
                  Deliver and release stock
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
                { label: "Due date", value: date(focused.dueDate) },
                { label: "Ship from", value: godowns[focused.godownId]?.name ?? "" },
                { label: "Channel", value: <ChannelBadge channel={focused.channel} /> },
              ]}
            />

            <SectionTitle>Line items</SectionTitle>
            <LinesTable
              columns={[
                { key: "item", label: "Item" },
                { key: "qty", label: "Qty", align: "right" },
                { key: "rate", label: "Rate", align: "right" },
                { key: "amount", label: "Amount", align: "right" },
              ]}
            >
              {focused.lines.map((line) => {
                const item = items[line.itemId];
                return (
                  <tr key={line.itemId} className="border-b border-line/70 last:border-0">
                    <td className="px-3 py-2.5">
                      <p className="text-[13px] font-medium text-ink">{item?.name}</p>
                      <p className="font-mono text-[11px] text-subtle">{item?.sku}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px] text-muted tnum">
                      {number(line.qty)} {item?.unit}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px] text-muted tnum">
                      {money(line.rate, { decimals: true })}
                      {line.discountPct > 0 ? (
                        <span className="ml-1 text-[11px] text-success">
                          -{line.discountPct}%
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px] font-medium text-ink tnum">
                      {money(salesLineNet(line), { decimals: true })}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-surface-2/60">
                <td colSpan={3} className="px-3 py-2.5 text-right text-[13px] font-medium text-ink">
                  Total with GST
                </td>
                <td className="px-3 py-2.5 text-right text-[15px] font-semibold text-ink tnum">
                  {money(salesTotal(focused), { decimals: true })}
                </td>
              </tr>
            </LinesTable>

            <SectionTitle>Payment</SectionTitle>
            <PaymentProgress
              total={salesTotal(focused)}
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

            {focused.status === "confirmed" ? (
              <p className="mt-4 rounded-xl bg-info-soft px-4 py-3 text-[12.5px] leading-relaxed text-info">
                This order is confirmed but the goods have not left the godown. The quantity
                is held against available stock and comes off the shelf when you deliver it.
              </p>
            ) : null}
          </>
        ) : null}
      </Drawer>

      {focused && payOpen ? (
        <PaymentModal
          onClose={() => setPayOpen(false)}
          title="Record customer payment"
          reference={focused.number}
          total={salesTotal(focused)}
          alreadyPaid={focused.amountPaid}
          onSubmit={(amount) => recordSalePayment(focused.id, amount)}
        />
      ) : null}

      {newOpen ? <NewSaleModal onClose={() => setNewOpen(false)} /> : null}
    </>
  );
}
