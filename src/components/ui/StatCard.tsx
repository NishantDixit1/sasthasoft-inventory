import type { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  sub,
  icon,
  delta,
  accent = "brand",
  footer,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  /** percentage change against the previous period */
  delta?: number | null;
  accent?: "brand" | "success" | "warning" | "danger" | "info";
  footer?: ReactNode;
}) {
  const accents = {
    brand: "bg-brand-soft text-brand",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    info: "bg-info-soft text-info",
  } as const;

  const up = (delta ?? 0) >= 0;

  return (
    <div className="group relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-xs transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        {icon ? (
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              accents[accent],
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-[26px] font-semibold leading-none tracking-[-0.02em] text-ink tnum">
        {value}
      </p>

      <div className="mt-2.5 flex items-center gap-2">
        {delta !== undefined && delta !== null ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[12px] font-medium tnum",
              up ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
            )}
          >
            {up ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {up ? "+" : ""}
            {delta.toFixed(1)}%
          </span>
        ) : null}
        {sub ? <span className="text-[12px] text-subtle">{sub}</span> : null}
      </div>

      {footer ? <div className="mt-3">{footer}</div> : null}
    </div>
  );
}
