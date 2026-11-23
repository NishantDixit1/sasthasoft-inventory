import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Compact label/value grid used at the top of every detail drawer. */
export function MetaGrid({
  rows,
  columns = 2,
}: {
  rows: { label: string; value: ReactNode }[];
  columns?: 2 | 3;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-5 gap-y-3.5 rounded-xl border border-line bg-surface-2/50 p-4",
        columns === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3",
      )}
    >
      {rows.map((row) => (
        <div key={row.label} className="min-w-0">
          <dt className="text-[11.5px] font-medium uppercase tracking-[0.04em] text-subtle">
            {row.label}
          </dt>
          <dd className="mt-1 truncate text-[13.5px] text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2.5 mt-5 text-[12px] font-semibold uppercase tracking-[0.05em] text-subtle">
      {children}
    </h3>
  );
}

/** Amount settled against the order total. */
export function PaymentProgress({
  total,
  paid,
  formatter,
}: {
  total: number;
  paid: number;
  formatter: (value: number) => string;
}) {
  const ratio = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
  const due = Math.max(0, total - paid);

  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] text-muted">Settled</p>
        <p className="text-[13px] text-ink tnum">
          {formatter(paid)} <span className="text-subtle">of {formatter(total)}</span>
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            due === 0 ? "bg-success" : "bg-warning",
          )}
          style={{ width: `${Math.max(2, ratio)}%` }}
        />
      </div>
      <p className="mt-2 text-[12.5px] text-muted">
        {due === 0 ? (
          <span className="text-success">Fully settled</span>
        ) : (
          <>
            <span className="font-medium text-danger tnum">{formatter(due)}</span> still
            outstanding
          </>
        )}
      </p>
    </div>
  );
}
