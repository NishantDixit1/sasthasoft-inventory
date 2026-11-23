import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface BarRow {
  key: string;
  label: ReactNode;
  caption?: ReactNode;
  value: number;
  display: ReactNode;
}

/** Ranked horizontal bars. Used for top items and category value. */
export function BarList({
  rows,
  tone = "brand",
}: {
  rows: BarRow[];
  tone?: "brand" | "info" | "success";
}) {
  const peak = Math.max(1, ...rows.map((row) => row.value));
  const fills = {
    brand: "bg-brand",
    info: "bg-info",
    success: "bg-success",
  } as const;

  return (
    <ol className="space-y-3.5">
      {rows.map((row, index) => (
        <li key={row.key}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="flex min-w-0 items-baseline gap-2 text-[13px] font-medium text-ink">
              <span className="w-4 shrink-0 text-[12px] text-subtle tnum">{index + 1}</span>
              <span className="truncate">{row.label}</span>
            </p>
            <span className="shrink-0 text-[13px] font-medium text-ink tnum">
              {row.display}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2.5 pl-6">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
              <div
                className={cn("h-full rounded-full transition-[width] duration-500", fills[tone])}
                style={{ width: `${Math.max(3, (row.value / peak) * 100)}%` }}
              />
            </div>
            {row.caption ? (
              <span className="shrink-0 text-[12px] text-subtle tnum">{row.caption}</span>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
