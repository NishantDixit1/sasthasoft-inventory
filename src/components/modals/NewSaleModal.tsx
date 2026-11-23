"use client";

import { useMemo, useState } from "react";
import { Plus, TriangleAlert } from "lucide-react";

import { LineHeadCell, LineTable, RemoveLineButton, TotalsPanel } from "./LineRows";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { money } from "@/lib/format";
import { useStock } from "@/lib/hooks";
import { salesLineNet, salesLineTax } from "@/lib/seed";
import { useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { SalesChannel, SalesLine } from "@/lib/types";
import { todayISO } from "@/lib/utils";

interface DraftLine extends SalesLine {
  key: number;
}

let lineSeq = 0;
const newLine = (itemId: string, rate: number): DraftLine => ({
  key: ++lineSeq,
  itemId,
  qty: 1,
  rate,
  discountPct: 0,
  taxPct: 18,
});

export function NewSaleModal({ onClose }: { onClose: () => void }) {
  const items = useApp((state) => state.items);
  const customers = useApp((state) => state.customers);
  const godowns = useApp((state) => state.godowns);
  const createSale = useApp((state) => state.createSale);
  const stock = useStock();

  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [godownId, setGodownId] = useState(godowns[0]?.id ?? "");
  const [date, setDate] = useState(todayISO());
  const [channel, setChannel] = useState<SalesChannel>("distributor");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>(() =>
    items[0] ? [newLine(items[0].id, items[0].sellPrice)] : [],
  );

  /** what is physically on the shelf at the chosen godown right now */
  const availableAt = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of stock) map[row.item.id] = row.byGodown[godownId] ?? 0;
    return map;
  }, [stock, godownId]);

  const subtotal = lines.reduce((total, line) => total + salesLineNet(line), 0);
  const tax = lines.reduce((total, line) => total + salesLineTax(line), 0);
  const discount = lines.reduce(
    (total, line) => total + Math.round(line.qty * line.rate * (line.discountPct / 100)),
    0,
  );
  const shortLines = lines.filter((line) => line.qty > (availableAt[line.itemId] ?? 0));

  function update(key: number, patch: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function submit(deliverNow: boolean) {
    const result = createSale({
      customerId,
      godownId,
      date,
      channel,
      notes: notes.trim() || undefined,
      deliverNow,
      lines: lines.map((line) => ({
        itemId: line.itemId,
        qty: line.qty,
        rate: line.rate,
        discountPct: line.discountPct,
        taxPct: line.taxPct,
      })),
    });

    if (!result.ok) {
      toast.error("Could not save the order", result.error.message);
      return;
    }
    toast.success(
      `${result.data.number} ${deliverNow ? "delivered" : "confirmed"}`,
      deliverNow
        ? "Stock has been released from the godown."
        : "Stock stays reserved until you mark it delivered.",
    );
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New sales order"
      subtitle="Delivering the order is what takes the stock out of the godown."
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => submit(false)} disabled={lines.length === 0}>
            Save as confirmed
          </Button>
          <Button
            variant="primary"
            onClick={() => submit(true)}
            disabled={lines.length === 0 || shortLines.length > 0}
            title={shortLines.length > 0 ? "Some lines exceed the stock on hand" : undefined}
          >
            Save and deliver
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Customer" htmlFor="sale-customer">
          <Select
            id="sale-customer"
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
          >
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ship from godown" htmlFor="sale-godown">
          <Select
            id="sale-godown"
            value={godownId}
            onChange={(event) => setGodownId(event.target.value)}
          >
            {godowns.map((godown) => (
              <option key={godown.id} value={godown.id}>
                {godown.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Order date" htmlFor="sale-date">
          <Input
            id="sale-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
        <Field label="Channel" htmlFor="sale-channel">
          <Select
            id="sale-channel"
            value={channel}
            onChange={(event) => setChannel(event.target.value as SalesChannel)}
          >
            <option value="distributor">Distributor</option>
            <option value="retail">Retail</option>
            <option value="online">Online</option>
          </Select>
        </Field>
      </div>

      <div className="mt-5">
        <LineTable
          head={
            <>
              <LineHeadCell className="w-[40%]">Item</LineHeadCell>
              <LineHeadCell align="right">In godown</LineHeadCell>
              <LineHeadCell align="right">Qty</LineHeadCell>
              <LineHeadCell align="right">Rate</LineHeadCell>
              <LineHeadCell align="right">Disc %</LineHeadCell>
              <LineHeadCell align="right">Amount</LineHeadCell>
              <LineHeadCell />
            </>
          }
          footer={
            <TotalsPanel
              rows={[
                { label: "Subtotal", value: money(subtotal + discount, { decimals: true }) },
                { label: "Discount", value: `- ${money(discount, { decimals: true })}` },
                { label: "GST 18%", value: money(tax, { decimals: true }) },
                { label: "Order total", value: money(subtotal + tax, { decimals: true }), strong: true },
              ]}
            />
          }
        >
          {lines.map((line) => {
            const item = items.find((candidate) => candidate.id === line.itemId);
            const available = availableAt[line.itemId] ?? 0;
            const short = line.qty > available;
            return (
              <tr key={line.key} className="border-b border-line/70 last:border-0">
                <td className="px-3 py-2">
                  <Select
                    value={line.itemId}
                    aria-label="Item"
                    onChange={(event) => {
                      const next = items.find((i) => i.id === event.target.value);
                      update(line.key, {
                        itemId: event.target.value,
                        rate: next?.sellPrice ?? line.rate,
                      });
                    }}
                  >
                    {items.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.sku} · {option.name}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-3 py-2 text-right">
                  <span
                    className={
                      short
                        ? "text-[13px] font-medium text-danger tnum"
                        : "text-[13px] text-muted tnum"
                    }
                  >
                    {available} {item?.unit}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    min={1}
                    aria-label="Quantity"
                    className="w-20 text-right"
                    value={line.qty}
                    onChange={(event) =>
                      update(line.key, { qty: Math.max(1, Number(event.target.value) || 0) })
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    min={0}
                    aria-label="Rate"
                    className="w-28 text-right"
                    value={line.rate / 100}
                    onChange={(event) =>
                      update(line.key, {
                        rate: Math.max(0, Math.round(Number(event.target.value) * 100)),
                      })
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    aria-label="Discount percent"
                    className="w-16 text-right"
                    value={line.discountPct}
                    onChange={(event) =>
                      update(line.key, {
                        discountPct: Math.min(100, Math.max(0, Number(event.target.value) || 0)),
                      })
                    }
                  />
                </td>
                <td className="px-3 py-2 text-right text-[13px] font-medium text-ink tnum">
                  {money(salesLineNet(line), { decimals: true })}
                </td>
                <td className="px-2 py-2 text-right">
                  <RemoveLineButton
                    onClick={() =>
                      setLines((current) => current.filter((row) => row.key !== line.key))
                    }
                  />
                </td>
              </tr>
            );
          })}
        </LineTable>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Button
            size="sm"
            variant="soft"
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => {
              const next = items[lines.length % items.length];
              setLines((current) => [...current, newLine(next.id, next.sellPrice)]);
            }}
          >
            Add line
          </Button>
          {shortLines.length > 0 ? (
            <p className="flex items-center gap-1.5 text-[12.5px] text-danger">
              <TriangleAlert className="h-3.5 w-3.5" />
              {shortLines.length === 1
                ? "1 line exceeds"
                : `${shortLines.length} lines exceed`}{" "}
              the stock in this godown. You can still save the order and deliver it once a
              purchase lands.
            </p>
          ) : null}
        </div>
      </div>

      <Field label="Notes" className="mt-5" htmlFor="sale-notes">
        <Textarea
          id="sale-notes"
          rows={2}
          value={notes}
          placeholder="Delivery instructions, site contact, anything the dispatch desk needs."
          onChange={(event) => setNotes(event.target.value)}
        />
      </Field>
    </Modal>
  );
}
