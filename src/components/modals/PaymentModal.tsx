"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { money } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { Result } from "@/lib/types";

export function PaymentModal({
  onClose,
  title,
  reference,
  total,
  alreadyPaid,
  onSubmit,
}: {
  onClose: () => void;
  title: string;
  reference: string;
  /** both in paise */
  total: number;
  alreadyPaid: number;
  onSubmit: (amountInPaise: number) => Result<unknown>;
}) {
  const due = Math.max(0, total - alreadyPaid);
  // mounted only while open, so the outstanding amount is the right default
  const [amount, setAmount] = useState(due / 100);

  function submit() {
    const result = onSubmit(Math.round(amount * 100));
    if (!result.ok) {
      toast.error("Could not record the payment", result.error.message);
      return;
    }
    toast.success(`${money(Math.round(amount * 100))} recorded against ${reference}`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      subtitle={reference}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={amount <= 0}>
            Record payment
          </Button>
        </>
      }
    >
      <dl className="mb-4 space-y-1.5 rounded-xl border border-line bg-surface-2/60 p-3.5">
        <div className="flex justify-between text-[13px]">
          <dt className="text-muted">Order total</dt>
          <dd className="text-ink tnum">{money(total, { decimals: true })}</dd>
        </div>
        <div className="flex justify-between text-[13px]">
          <dt className="text-muted">Already settled</dt>
          <dd className="text-ink tnum">{money(alreadyPaid, { decimals: true })}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-1.5 text-[13px] font-medium">
          <dt className="text-ink">Outstanding</dt>
          <dd className="text-danger tnum">{money(due, { decimals: true })}</dd>
        </div>
      </dl>

      <Field label="Amount received" htmlFor="payment-amount">
        <Input
          id="payment-amount"
          type="number"
          min={0}
          max={due / 100}
          step="0.01"
          prefix="₹"
          value={amount}
          onChange={(event) => setAmount(Math.max(0, Number(event.target.value) || 0))}
        />
      </Field>

      <div className="mt-2.5 flex gap-2">
        {[0.25, 0.5, 1].map((fraction) => (
          <Button
            key={fraction}
            size="sm"
            variant="secondary"
            onClick={() => setAmount(Math.round(due * fraction) / 100)}
          >
            {fraction === 1 ? "Full amount" : `${fraction * 100}%`}
          </Button>
        ))}
      </div>
    </Modal>
  );
}
