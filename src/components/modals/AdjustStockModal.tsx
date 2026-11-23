"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useOnHand } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import { toast } from "@/lib/toast";

const REASONS = [
  "Physical count correction",
  "Damaged in handling",
  "Sample issued",
  "Found during audit",
  "Expired or written off",
];

/**
 * Corrects on-hand to a counted figure and posts the difference as a movement.
 * Mounted only while open, so the fields always start from the current state.
 */
export function AdjustStockModal({
  onClose,
  itemId: fixedItemId,
}: {
  onClose: () => void;
  itemId?: string;
}) {
  const items = useApp((state) => state.items);
  const godowns = useApp((state) => state.godowns);
  const adjustStock = useApp((state) => state.adjustStock);

  const [itemId, setItemId] = useState(fixedItemId ?? items[0]?.id ?? "");
  const [godownId, setGodownId] = useState(godowns[0]?.id ?? "");
  const [reason, setReason] = useState(REASONS[0]);
  /**
   * Until the figure is typed, the field simply shows what the system holds.
   * Tracking which item and godown the entry belongs to means switching either
   * one falls back to the live figure without an effect to reset it.
   */
  const [entered, setEntered] = useState<{
    itemId: string;
    godownId: string;
    value: number;
  } | null>(null);

  const current = useOnHand(itemId, godownId);
  const item = items.find((candidate) => candidate.id === itemId);
  const counted =
    entered && entered.itemId === itemId && entered.godownId === godownId
      ? entered.value
      : current;
  const delta = counted - current;

  function submit() {
    const result = adjustStock({ itemId, godownId, countedQty: counted, reason });
    if (!result.ok) {
      toast.error("Could not adjust the stock", result.error.message);
      return;
    }
    if (result.data === null) {
      toast.info("Nothing to adjust", "The counted quantity already matches the system.");
    } else {
      toast.success(
        `${item?.name} adjusted by ${delta > 0 ? "+" : ""}${delta}`,
        "The movement is recorded in the stock history.",
      );
    }
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Adjust stock"
      subtitle="Enter what was physically counted. The difference is posted as an adjustment."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Post adjustment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Item" htmlFor="adjust-item">
          <Select
            id="adjust-item"
            value={itemId}
            disabled={Boolean(fixedItemId)}
            onChange={(event) => setItemId(event.target.value)}
          >
            {items.map((option) => (
              <option key={option.id} value={option.id}>
                {option.sku} · {option.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Godown" htmlFor="adjust-godown">
          <Select
            id="adjust-godown"
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

        <div className="flex items-end gap-3">
          <Field label="System says" className="flex-1">
            <Input value={current} readOnly className="bg-surface-2 text-muted" />
          </Field>
          <ArrowRight className="mb-2.5 h-4 w-4 shrink-0 text-subtle" />
          <Field label="Counted" className="flex-1" htmlFor="adjust-counted">
            <Input
              id="adjust-counted"
              type="number"
              min={0}
              value={counted}
              onChange={(event) =>
                setEntered({
                  itemId,
                  godownId,
                  value: Math.max(0, Number(event.target.value) || 0),
                })
              }
            />
          </Field>
        </div>

        {delta !== 0 ? (
          <p
            className={
              delta > 0
                ? "rounded-lg bg-success-soft px-3 py-2 text-[13px] text-success"
                : "rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger"
            }
          >
            Stock will change by {delta > 0 ? "+" : ""}
            {delta} {item?.unit}.
          </p>
        ) : null}

        <Field label="Reason" htmlFor="adjust-reason">
          <Select
            id="adjust-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          >
            {REASONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
