"use client";

import { useState } from "react";

import { LineHeadCell, LineTable } from "./LineRows";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { PurchaseOrder } from "@/lib/types";

/** Receiving is the step that actually adds stock. */
export function ReceiveGoodsModal({
  order,
  onClose,
}: {
  order: PurchaseOrder;
  onClose: () => void;
}) {
  const items = useApp((state) => state.items);
  const godowns = useApp((state) => state.godowns);
  const receivePurchase = useApp((state) => state.receivePurchase);

  // defaults to the outstanding balance, so the common case is one click
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      order.lines.map((line) => [line.itemId, Math.max(0, line.qty - line.receivedQty)]),
    ),
  );

  const godown = godowns.find((candidate) => candidate.id === order.godownId);
  const totalUnits = Object.values(quantities).reduce((total, qty) => total + qty, 0);

  function submit() {
    const result = receivePurchase(order.id, quantities);
    if (!result.ok) {
      toast.error("Could not receive the goods", result.error.message);
      return;
    }
    toast.success(
      `${totalUnits} units received into ${godown?.name ?? "stock"}`,
      result.data.status === "received"
        ? `${order.number} is now fully received.`
        : `${order.number} is part received, the balance is still open.`,
    );
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Receive goods against ${order.number}`}
      subtitle={`Stock will be added to ${godown?.name ?? "the godown"} straight away.`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={totalUnits === 0}>
            Receive {totalUnits} units
          </Button>
        </>
      }
    >
      <LineTable
        head={
          <>
            <LineHeadCell className="w-[46%]">Item</LineHeadCell>
            <LineHeadCell align="right">Ordered</LineHeadCell>
            <LineHeadCell align="right">Already in</LineHeadCell>
            <LineHeadCell align="right">Outstanding</LineHeadCell>
            <LineHeadCell align="right">Receiving now</LineHeadCell>
          </>
        }
      >
        {order.lines.map((line) => {
          const item = items.find((candidate) => candidate.id === line.itemId);
          const outstanding = Math.max(0, line.qty - line.receivedQty);
          return (
            <tr key={line.itemId} className="border-b border-line/70 last:border-0">
              <td className="px-3 py-2.5">
                <p className="text-[13.5px] font-medium text-ink">{item?.name}</p>
                <p className="font-mono text-[11.5px] text-subtle">{item?.sku}</p>
              </td>
              <td className="px-3 py-2.5 text-right text-[13px] text-muted tnum">{line.qty}</td>
              <td className="px-3 py-2.5 text-right text-[13px] text-muted tnum">
                {line.receivedQty}
              </td>
              <td className="px-3 py-2.5 text-right text-[13px] font-medium text-ink tnum">
                {outstanding}
              </td>
              <td className="px-3 py-2.5">
                <Input
                  type="number"
                  min={0}
                  max={outstanding}
                  aria-label={`Quantity received for ${item?.name}`}
                  className="ml-auto w-24 text-right"
                  value={quantities[line.itemId] ?? 0}
                  disabled={outstanding === 0}
                  onChange={(event) =>
                    setQuantities((current) => ({
                      ...current,
                      [line.itemId]: Math.min(
                        outstanding,
                        Math.max(0, Number(event.target.value) || 0),
                      ),
                    }))
                  }
                />
              </td>
            </tr>
          );
        })}
      </LineTable>

      <div className="mt-3 flex justify-end gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            setQuantities(Object.fromEntries(order.lines.map((line) => [line.itemId, 0])))
          }
        >
          Clear all
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            setQuantities(
              Object.fromEntries(
                order.lines.map((line) => [
                  line.itemId,
                  Math.max(0, line.qty - line.receivedQty),
                ]),
              ),
            )
          }
        >
          Receive everything outstanding
        </Button>
      </div>
    </Modal>
  );
}
