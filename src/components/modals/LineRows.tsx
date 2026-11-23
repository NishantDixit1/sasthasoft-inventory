"use client";

import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/** Shared chrome for the line item editors in the sale and purchase modals. */
export function LineTable({
  head,
  children,
  footer,
}: {
  head: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2/70 text-[11.5px] uppercase tracking-[0.04em] text-subtle">
              {head}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}

export function LineHeadCell({
  children,
  align = "left",
  className,
}: {
  children?: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-3 py-2 font-medium",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function RemoveLineButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label="Remove line"
      className="h-8 w-8 text-subtle hover:text-danger"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

export function TotalsPanel({
  rows,
}: {
  rows: { label: string; value: string; strong?: boolean; tone?: "danger" }[];
}) {
  return (
    <dl className="space-y-1.5 border-t border-line bg-surface-2/50 px-4 py-3">
      {rows.map((row) => (
        <div
          key={row.label}
          className={cn(
            "flex items-center justify-between gap-6",
            row.strong && "border-t border-line pt-2 mt-2",
          )}
        >
          <dt
            className={cn(
              "text-[13px] text-muted",
              row.strong && "text-[14px] font-medium text-ink",
            )}
          >
            {row.label}
          </dt>
          <dd
            className={cn(
              "text-[13px] text-ink tnum",
              row.strong && "text-[16px] font-semibold",
              row.tone === "danger" && "text-danger",
            )}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
