"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { LineHeadCell, LineTable, RemoveLineButton, TotalsPanel } from "./LineRows";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { money } from "@/lib/format";
import { useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { addDays, todayISO } from "@/lib/utils";

interface DraftLine {
  key: number;
  itemId: string;
  qty: number;
  rate: number;
  taxPct: number;
}

let lineSeq = 0;

export function NewPurchaseModal({
  onClose,
  /** pre-fill the order with one item, used by the low stock reorder button */
  seedItemId,
}: {
  onClose: () => void;
  seedItemId?: string;
}) {
  const items = useApp((state) => state.items);
  const suppliers = useApp((state) => state.suppliers);
  const godowns = useApp((state) => state.godowns);
  const createPurchase = useApp((state) => state.createPurchase);

  // Opening from a low stock alert lands on that item, at its reorder
  // quantity, with its usual supplier already selected.
  const seed = items.find((item) => item.id === seedItemId) ?? items[0];

  const [supplierId, setSupplierId] = useState(
    seed?.preferredSupplierId ?? suppliers[0]?.id ?? "",
  );
  const [godownId, setGodownId] = useState(godowns[0]?.id ?? "");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>(() =>
    seed
      ? [
          {
            key: ++lineSeq,
            itemId: seed.id,
            qty: seed.reorderQty,
            rate: seed.costPrice,
            taxPct: 18,
          },
        ]
      : [],
  );

  const supplier = suppliers.find((candidate) => candidate.id === supplierId);
  const expectedDate = addDays(date, supplier?.leadTimeDays ?? 7);

  const subtotal = lines.reduce((total, line) => total + line.qty * line.rate, 0);
  const tax = lines.reduce(
    (total, line) => total + Math.round(line.qty * line.rate * (line.taxPct / 100)),
    0,
  );

  function update(key: number, patch: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function submit() {
    const result = createPurchase({
      supplierId,
      godownId,
      date,
      expectedDate,
      notes: notes.trim() || undefined,
      lines: lines.map((line) => ({
        itemId: line.itemId,
        qty: line.qty,
        rate: line.rate,
        taxPct: line.taxPct,
      })),
    });
    if (!result.ok) {
      toast.error("Could not raise the order", result.error.message);
      return;
    }
    toast.success(
      `${result.data.number} raised`,
      "Receive the goods against it to add the stock in.",
    );
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New purchase order"
      subtitle="Stock goes up only when you receive goods against the order."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={lines.length === 0}>
            Raise purchase order
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Supplier" htmlFor="po-supplier">
          <Select
            id="po-supplier"
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
          >
            {suppliers.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Receive into" htmlFor="po-godown">
          <Select
            id="po-godown"
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
        <Field label="Order date" htmlFor="po-date">
          <Input
            id="po-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
        <Field label="Expected" hint={`${supplier?.leadTimeDays ?? 7} day lead time`}>
          <Input value={expectedDate} readOnly className="bg-surface-2 text-muted" />
        </Field>
      </div>

      <div className="mt-5">
        <LineTable
          head={
            <>
              <LineHeadCell className="w-[48%]">Item</LineHeadCell>
              <LineHeadCell align="right">Qty</LineHeadCell>
              <LineHeadCell align="right">Cost</LineHeadCell>
              <LineHeadCell align="right">Amount</LineHeadCell>
              <LineHeadCell />
            </>
          }
          footer={
            <TotalsPanel
              rows={[
                { label: "Subtotal", value: money(subtotal, { decimals: true }) },
                { label: "GST 18%", value: money(tax, { decimals: true }) },
                { label: "Order total", value: money(subtotal + tax, { decimals: true }), strong: true },
              ]}
            />
          }
        >
          {lines.map((line) => (
            <tr key={line.key} className="border-b border-line/70 last:border-0">
              <td className="px-3 py-2">
                <Select
                  value={line.itemId}
                  aria-label="Item"
                  onChange={(event) => {
                    const next = items.find((i) => i.id === event.target.value);
                    update(line.key, {
                      itemId: event.target.value,
                      rate: next?.costPrice ?? line.rate,
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
              <td className="px-3 py-2">
                <Input
                  type="number"
                  min={1}
                  aria-label="Quantity"
                  className="w-24 text-right"
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
                  aria-label="Unit cost"
                  className="w-28 text-right"
                  value={line.rate / 100}
                  onChange={(event) =>
                    update(line.key, {
                      rate: Math.max(0, Math.round(Number(event.target.value) * 100)),
                    })
                  }
                />
              </td>
              <td className="px-3 py-2 text-right text-[13px] font-medium text-ink tnum">
                {money(line.qty * line.rate, { decimals: true })}
              </td>
              <td className="px-2 py-2 text-right">
                <RemoveLineButton
                  onClick={() =>
                    setLines((current) => current.filter((row) => row.key !== line.key))
                  }
                />
              </td>
            </tr>
          ))}
        </LineTable>

        <Button
          size="sm"
          variant="soft"
          className="mt-3"
          icon={<Plus className="h-3.5 w-3.5" />}
          onClick={() => {
            const next = items[lines.length % items.length];
            setLines((current) => [
              ...current,
              { key: ++lineSeq, itemId: next.id, qty: next.reorderQty, rate: next.costPrice, taxPct: 18 },
            ]);
          }}
        >
          Add line
        </Button>
      </div>

      <Field label="Notes" className="mt-5" htmlFor="po-notes">
        <Textarea
          id="po-notes"
          rows={2}
          value={notes}
          placeholder="Payment terms, delivery window, anything the supplier should know."
          onChange={(event) => setNotes(event.target.value)}
        />
      </Field>
    </Modal>
  );
}
