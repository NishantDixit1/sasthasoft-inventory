"use client";

import { useMemo, useState } from "react";
import { Building2, Clock, Mail, Phone, Star, Wallet } from "lucide-react";

import { ItemCell, PartyCell, PaymentBadge, PurchaseStatusBadge } from "@/components/domain/Indicators";
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
import { purchaseTotal } from "@/lib/seed";
import { rollupBySupplier, type PartyRollup } from "@/lib/selectors";
import { useApp } from "@/lib/store";
import { useQueryState } from "@/lib/useQueryState";
import type { Supplier } from "@/lib/types";

export function SuppliersClient() {
  const suppliers = useApp((state) => state.suppliers);
  const purchaseOrders = useApp((state) => state.purchaseOrders);
  const items = useApp((state) => state.items);

  const [query, setQuery] = useState("");
  const [city, setCity] = useState("all");
  const [focusId, setFocusId] = useQueryState("focus");

  const rollups = useMemo(
    () => rollupBySupplier(purchaseOrders, suppliers),
    [purchaseOrders, suppliers],
  );

  const cities = useMemo(
    () => Array.from(new Set(suppliers.map((supplier) => supplier.city))).sort(),
    [suppliers],
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
        ? purchaseOrders.filter((order) => order.supplierId === focused.party.id).slice(0, 8)
        : [],
    [focused, purchaseOrders],
  );
  const focusedItems = useMemo(
    () =>
      focused ? items.filter((item) => item.preferredSupplierId === focused.party.id) : [],
    [focused, items],
  );

  const totals = useMemo(
    () => ({
      payable: rollups.reduce((total, row) => total + row.outstanding, 0),
      spend: rollups.reduce((total, row) => total + row.value, 0),
      avgLead: Math.round(
        suppliers.reduce((total, supplier) => total + supplier.leadTimeDays, 0) /
          Math.max(1, suppliers.length),
      ),
    }),
    [rollups, suppliers],
  );

  const columns: Column<PartyRollup<Supplier>>[] = [
    {
      key: "name",
      header: "Supplier",
      sort: (a, b) => a.party.name.localeCompare(b.party.name),
      cell: (row) => <PartyCell tone="info" name={row.party.name} caption={row.party.code} />,
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
      key: "lead",
      header: "Lead time",
      align: "right",
      sort: (a, b) => a.party.leadTimeDays - b.party.leadTimeDays,
      cell: (row) => (
        <span className="text-[13px] text-muted tnum">{row.party.leadTimeDays} days</span>
      ),
    },
    {
      key: "rating",
      header: "Rating",
      align: "right",
      sort: (a, b) => a.party.rating - b.party.rating,
      cell: (row) => (
        <span className="inline-flex items-center gap-1 text-[13px] text-ink tnum">
          <Star className="h-3 w-3 fill-warning text-warning" />
          {row.party.rating.toFixed(1)}
        </span>
      ),
    },
    {
      key: "value",
      header: "Purchased",
      align: "right",
      sort: (a, b) => a.value - b.value,
      cell: (row) => (
        <span className="text-[13.5px] font-medium text-ink tnum">{money(row.value)}</span>
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
  ];

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Who you buy from, how quickly they deliver and what is still owed to them."
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Suppliers on file"
          value={suppliers.length}
          sub={`${rollups.filter((row) => row.orders > 0).length} with orders raised`}
          icon={<Building2 className="h-4 w-4" />}
          accent="info"
        />
        <StatCard
          label="Total purchased"
          value={moneyCompact(totals.spend)}
          sub="Excluding cancelled orders"
          icon={<Wallet className="h-4 w-4" />}
          accent="brand"
        />
        <StatCard
          label="Average lead time"
          value={`${totals.avgLead} days`}
          sub={`${moneyCompact(totals.payable)} payable`}
          icon={<Clock className="h-4 w-4" />}
          accent="warning"
        />
      </div>

      <Card>
        <Toolbar
          query={query}
          onQueryChange={setQuery}
          placeholder="Search supplier, code or contact"
          trailing={
            <p className="text-[12.5px] text-subtle tnum">
              {rows.length} of {suppliers.length} suppliers
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
              icon={<Building2 className="h-5 w-5" />}
              title="No suppliers match this search"
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
                { label: "Lead time", value: `${focused.party.leadTimeDays} days` },
                {
                  label: "Rating",
                  value: (
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3 w-3 fill-warning text-warning" />
                      {focused.party.rating.toFixed(1)} of 5
                    </span>
                  ),
                },
              ]}
            />

            <SectionTitle>Items supplied</SectionTitle>
            {focusedItems.length === 0 ? (
              <EmptyState title="No items list this supplier as preferred" />
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {focusedItems.map((item) => (
                  <li key={item.id} className="px-4 py-2.5">
                    <ItemCell name={item.name} sku={item.sku} brand={item.brand} />
                  </li>
                ))}
              </ul>
            )}

            <SectionTitle>Recent purchase orders</SectionTitle>
            {focusedOrders.length === 0 ? (
              <EmptyState title="No purchase orders yet" />
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
                        <PurchaseStatusBadge status={order.status} />
                        <PaymentBadge status={order.paymentStatus} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px] font-medium text-ink tnum">
                      {money(purchaseTotal(order))}
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
