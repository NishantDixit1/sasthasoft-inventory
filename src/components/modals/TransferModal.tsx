"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";

import { LineHeadCell, LineTable, RemoveLineButton } from "./LineRows";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useStock } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { todayISO } from "@/lib/utils";

interface DraftLine {
  key: number;
  itemId: string;
  qty: number;
}

let lineSeq = 0;

/** Moves stock between godowns as a paired out and in movement. */
export function TransferModal({ onClose }: { onClose: () => void }) {
  const godowns = useApp((state) => state.godowns);
  const items = useApp((state) => state.items);
  const createTransfer = useApp((state) => state.createTransfer);
  const stock = useStock();

  const [fromGodownId, setFrom] = useState(godowns[0]?.id ?? "");
  const [toGodownId, setTo] = useState(godowns[1]?.id ?? "");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([
    { key: ++lineSeq, itemId: items[0]?.id ?? "", qty: 10 },
  ]);

  const availableAt = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of stock) map[row.item.id] = row.byGodown[fromGodownId] ?? 0;
    return map;
  }, [stock, fromGodownId]);

  function submit() {
    const result = createTransfer({
      fromGodownId,
      toGodownId,
      date,
      notes: notes.trim() || undefined,
      lines: lines.map(({ itemId, qty }) => ({ itemId, qty })),
    });
    if (!result.ok) {
      toast.error("Could not complete the transfer", result.error.message);
      return;
    }
    toast.success(
      `${result.data.number} completed`,
      `${result.data.lines.length} items moved between godowns.`,
    );
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Transfer stock"
      subtitle="Moves quantity between godowns without touching the overall stock on hand."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={lines.length === 0}>
            Complete transfer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <Field label="From godown" className="flex-1" htmlFor="tr-from">
          <Select id="tr-from" value={fromGodownId} onChange={(event) => setFrom(event.target.value)}>
            {godowns.map((godown) => (
              <option key={godown.id} value={godown.id}>
                {godown.name}
              </option>
            ))}
          </Select>
        </Field>
        <ArrowRight className="mb-2.5 hidden h-4 w-4 shrink-0 text-subtle sm:block" />
        <Field label="To godown" className="flex-1" htmlFor="tr-to">
          <Select id="tr-to" value={toGodownId} onChange={(event) => setTo(event.target.value)}>
            {godowns.map((godown) => (
              <option key={godown.id} value={godown.id}>
                {godown.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date" className="sm:w-40" htmlFor="tr-date">
          <Input
            id="tr-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
      </div>

      <div className="mt-5">
        <LineTable
          head={
            <>
              <LineHeadCell className="w-[60%]">Item</LineHeadCell>
              <LineHeadCell align="right">At source</LineHeadCell>
              <LineHeadCell align="right">Qty to move</LineHeadCell>
              <LineHeadCell />
            </>
          }
        >
          {lines.map((line) => {
            const available = availableAt[line.itemId] ?? 0;
            return (
              <tr key={line.key} className="border-b border-line/70 last:border-0">
                <td className="px-3 py-2">
                  <Select
                    value={line.itemId}
                    aria-label="Item"
                    onChange={(event) =>
                      setLines((current) =>
                        current.map((row) =>
                          row.key === line.key ? { ...row, itemId: event.target.value } : row,
                        ),
                      )
                    }
                  >
                    {items.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.sku} · {option.name}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-3 py-2 text-right text-[13px] text-muted tnum">{available}</td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    min={0}
                    max={available}
                    aria-label="Quantity"
                    className="ml-auto w-24 text-right"
                    value={line.qty}
                    onChange={(event) =>
                      setLines((current) =>
                        current.map((row) =>
                          row.key === line.key
                            ? {
                                ...row,
                                qty: Math.min(available, Math.max(0, Number(event.target.value) || 0)),
                              }
                            : row,
                        ),
                      )
                    }
                  />
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

        <Button
          size="sm"
          variant="soft"
          className="mt-3"
          icon={<Plus className="h-3.5 w-3.5" />}
          onClick={() =>
            setLines((current) => [
              ...current,
              { key: ++lineSeq, itemId: items[current.length % items.length].id, qty: 10 },
            ])
          }
        >
          Add line
        </Button>
      </div>

      <Field label="Notes" className="mt-5" htmlFor="tr-notes">
        <Textarea
          id="tr-notes"
          rows={2}
          value={notes}
          placeholder="Reason for moving the stock."
          onChange={(event) => setNotes(event.target.value)}
        />
      </Field>
    </Modal>
  );
}
