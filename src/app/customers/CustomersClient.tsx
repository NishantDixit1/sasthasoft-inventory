"use client";

import { useMemo, useState } from "react";
import { Mail, Phone, Users, Wallet } from "lucide-react";

import { PartyCell, PaymentBadge, SalesStatusBadge } from "@/components/domain/Indicators";
import { LinesTable } from "@/components/domain/LinesTable";
import { MetaGrid, SectionTitle } from "@/components/domain/MetaGrid";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { FilterSelect, Toolbar } from "@/components/ui/Toolbar";
import { date, money, moneyCompact } from "@/lib/format";
import { salesTotal } from "@/lib/seed";
import { rollupByCustomer, type PartyRollup } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { useQueryState } from "@/lib/useQueryState";
import type { Customer } from "@/lib/types";

export function CustomersClient() {
  const customers = useApp((state) => state.customers);
  const salesOrders = useApp((state) => state.salesOrders);

  const [query, setQuery] = useState("");
  const [city, setCity] = useState("all");
  const [focusId, setFocusId] = useQueryState("focus");

  const rollups = useMemo(
    () => rollupByCustomer(salesOrders, customers),
    [salesOrders, customers],
  );

  const cities = useMemo(
    () => Array.from(new Set(customers.map((customer) => customer.city))).sort(),
    [customers],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rollups.filter((row) => {
      const matches =
        !needle ||
        row.party.name.toLowerCase().includes(needle) ||
        row.party.code.toLowerCase().includes(needle) ||
        row.party.contactPerson.toLowerCase().includes(needle);
      return matches && (city === "all" || row.party.city === city);
    });
  }, [rollups, query, city]);

  const focused = rollups.find((row) => row.party.id === focusId) ?? null;
  const focusedOrders = useMemo(
    () =>
      focused
        ? salesOrders.filter((order) => order.customerId === focused.party.id).slice(0, 8)
        : [],
    [focused, salesOrders],
  );

  const totals = useMemo(
    () => ({
      receivable: rollups.reduce((total, row) => total + row.outstanding, 0),
      revenue: rollups.reduce((total, row) => total + row.value, 0),
      active: rollups.filter((row) => row.orders > 0).length,
    }),
    [rollups],
  );

  const columns: Column<PartyRollup<Customer>>[] = [
    {
      key: "name",
      header: "Customer",
      sort: (a, b) => a.party.name.localeCompare(b.party.name),
      cell: (row) => <PartyCell name={row.party.name} caption={row.party.code} />,
    },
    {
      key: "city",
      header: "City",
      sort: (a, b) => a.party.city.localeCompare(b.party.city),
      cell: (row) => <span className="text-[13px] text-muted">{row.party.city}</span>,
    },
    {
      key: "contact",
      header: "Contact",
      className: "hidden lg:table-cell",
      headerClassName: "hidden lg:table-cell",
      cell: (row) => (
        <div>
          <p className="text-[13px] text-ink">{row.party.contactPerson}</p>
          <p className="mt-0.5 text-[11.5px] text-subtle">{row.party.phone}</p>
        </div>
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
      key: "value",
      header: "Lifetime value",
      align: "right",
      sort: (a, b) => a.value - b.value,
      cell: (row) => (
        <span className="text-[13.5px] font-medium text-ink tnum">{money(row.value)}</span>
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
    {
      key: "last",
      header: "Last order",
      align: "right",
      sort: (a, b) => (a.lastOrder ?? "").localeCompare(b.lastOrder ?? ""),
      cell: (row) => (
        <span className="text-[13px] text-muted">
          {row.lastOrder ? date(row.lastOrder) : "—"}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Customers"
        description="Who buys from you, what they owe and when they last ordered."
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Customers on file"
          value={customers.length}
          sub={`${totals.active} have placed an order`}
          icon={<Users className="h-4 w-4" />}
          accent="brand"
        />
        <StatCard
          label="Lifetime sales value"
          value={moneyCompact(totals.revenue)}
          sub="Excluding cancelled orders"
          icon={<Wallet className="h-4 w-4" />}
          accent="success"
        />
        <StatCard
          label="Receivables outstanding"
          value={moneyCompact(totals.receivable)}
          sub="Still to be collected"
          icon={<Wallet className="h-4 w-4" />}
          accent="warning"
        />
      </div>

      <Card>
        <Toolbar
          query={query}
          onQueryChange={setQuery}
          placeholder="Search customer, code or contact"
          trailing={
            <p className="text-[12.5px] text-subtle tnum">
              {rows.length} of {customers.length} customers
            </p>
          }
        >
          <FilterSelect
            label="City"
            value={city}
            onChange={setCity}
            options={cities.map((value) => ({ value, label: value }))}
          />
        </Toolbar>

        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(row) => row.party.id}
          onRowClick={(row) => setFocusId(row.party.id)}
          initialSort={{ key: "value", direction: "desc" }}
          pageSize={10}
          empty={
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="No customers match this search"
            />
          }
        />
      </Card>

      <Drawer
        open={Boolean(focused)}
        onClose={() => setFocusId(null)}
        title={focused?.party.name ?? ""}
        subtitle={focused ? `${focused.party.code} · ${focused.party.city}` : undefined}
      >
        {focused ? (
          <>
            <MetaGrid
              rows={[
                { label: "Contact", value: focused.party.contactPerson },
                {
                  label: "Phone",
                  value: (
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3 text-subtle" />
                      {focused.party.phone}
                    </span>
                  ),
                },
                {
                  label: "Email",
                  value: (
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3 shrink-0 text-subtle" />
                      <span className="truncate">{focused.party.email}</span>
                    </span>
                  ),
                },
                { label: "GSTIN", value: <span className="font-mono text-[12.5px]">{focused.party.gstin}</span> },
                { label: "Credit limit", value: money(focused.party.creditLimitInPaise) },
                { label: "Customer since", value: date(focused.party.since) },
              ]}
            />

            <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
              <div className="bg-surface px-4 py-3">
                <p className="text-[11.5px] text-muted">Orders</p>
                <p className="mt-1 text-[17px] font-semibold text-ink tnum">{focused.orders}</p>
              </div>
              <div className="bg-surface px-4 py-3">
                <p className="text-[11.5px] text-muted">Lifetime value</p>
                <p className="mt-1 text-[17px] font-semibold text-ink tnum">
                  {moneyCompact(focused.value)}
                </p>
              </div>
              <div className="bg-surface px-4 py-3">
                <p className="text-[11.5px] text-muted">Outstanding</p>
                <p
                  className={`mt-1 text-[17px] font-semibold tnum ${
                    focused.outstanding > 0 ? "text-danger" : "text-success"
                  }`}
                >
                  {moneyCompact(focused.outstanding)}
                </p>
              </div>
            </div>

            <SectionTitle>Recent orders</SectionTitle>
            {focusedOrders.length === 0 ? (
              <EmptyState title="No orders yet" />
            ) : (
              <LinesTable
                columns={[
                  { key: "order", label: "Order" },
                  { key: "status", label: "Status" },
                  { key: "amount", label: "Amount", align: "right" },
                ]}
              >
                {focusedOrders.map((order) => (
                  <tr key={order.id} className="border-b border-line/70 last:border-0">
                    <td className="px-3 py-2.5">
                      <p className="font-mono text-[12.5px] font-medium text-ink">
                        {order.number}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-subtle">{date(order.date)}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        <SalesStatusBadge status={order.status} />
                        <PaymentBadge status={order.paymentStatus} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px] font-medium text-ink tnum">
                      {money(salesTotal(order))}
                    </td>
                  </tr>
                ))}
              </LinesTable>
            )}
          </>
        ) : null}
      </Drawer>
    </>
  );
}
