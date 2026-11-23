import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { HEALTH_LABEL } from "@/lib/selectors";
import type {
  PaymentStatus,
  PurchaseStatus,
  SalesChannel,
  SalesStatus,
  StockHealth,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const SALES: Record<SalesStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  confirmed: { label: "Confirmed", tone: "info" },
  delivered: { label: "Delivered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

const PURCHASE: Record<PurchaseStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  ordered: { label: "Pending", tone: "warning" },
  partial: { label: "Part received", tone: "info" },
  received: { label: "Received", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

const PAYMENT: Record<PaymentStatus, { label: string; tone: BadgeTone }> = {
  unpaid: { label: "Unpaid", tone: "danger" },
  partial: { label: "Part paid", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
};

const HEALTH: Record<StockHealth, BadgeTone> = {
  out: "danger",
  critical: "danger",
  low: "warning",
  healthy: "success",
  excess: "info",
};

export function SalesStatusBadge({ status }: { status: SalesStatus }) {
  const config = SALES[status];
  return (
    <Badge tone={config.tone} dot>
      {config.label}
    </Badge>
  );
}

export function PurchaseStatusBadge({ status }: { status: PurchaseStatus }) {
  const config = PURCHASE[status];
  return (
    <Badge tone={config.tone} dot>
      {config.label}
    </Badge>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const config = PAYMENT[status];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

export function HealthBadge({ health }: { health: StockHealth }) {
  return (
    <Badge tone={HEALTH[health]} dot>
      {HEALTH_LABEL[health]}
    </Badge>
  );
}

export function ChannelBadge({ channel }: { channel: SalesChannel }) {
  const labels: Record<SalesChannel, string> = {
    retail: "Retail",
    online: "Online",
    distributor: "Distributor",
  };
  return <Badge tone="neutral">{labels[channel]}</Badge>;
}

/**
 * Quantity against the minimum level, as a bar. The marker sits at the minimum
 * so it is obvious at a glance how close an item is to running out.
 */
export function StockLevelBar({
  onHand,
  minLevel,
  health,
  className,
}: {
  onHand: number;
  minLevel: number;
  health: StockHealth;
  className?: string;
}) {
  const ceiling = Math.max(onHand, minLevel * 2.2, 1);
  const fill = Math.min(100, (Math.max(0, onHand) / ceiling) * 100);
  const marker = Math.min(100, (minLevel / ceiling) * 100);

  const fills: Record<StockHealth, string> = {
    out: "bg-danger",
    critical: "bg-danger",
    low: "bg-warning",
    healthy: "bg-success",
    excess: "bg-info",
  };

  return (
    <div
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}
      title={`${onHand} on hand, minimum ${minLevel}`}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", fills[health])}
        style={{ width: `${Math.max(fill, onHand > 0 ? 4 : 0)}%` }}
      />
      <span
        className="absolute top-[-2px] h-[10px] w-[2px] rounded-full bg-ink/45"
        style={{ left: `calc(${marker}% - 1px)` }}
      />
    </div>
  );
}

/** Item name over its SKU, the cell used in every item-bearing table. */
export function ItemCell({
  name,
  sku,
  brand,
}: {
  name: string;
  sku: string;
  brand?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[13.5px] font-medium text-ink">{name}</p>
      <p className="mt-0.5 flex items-center gap-1.5 truncate font-mono text-[11.5px] text-subtle">
        {sku}
        {brand ? <span className="font-sans text-subtle">· {brand}</span> : null}
      </p>
    </div>
  );
}

/** Party avatar plus name, used for customers and suppliers. */
export function PartyCell({
  name,
  caption,
  tone = "brand",
}: {
  name: string;
  caption?: string;
  tone?: "brand" | "info";
}) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold",
          tone === "brand" ? "bg-brand-soft text-brand" : "bg-info-soft text-info",
        )}
      >
        {letters}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[13.5px] font-medium text-ink">{name}</p>
        {caption ? <p className="truncate text-[11.5px] text-subtle">{caption}</p> : null}
      </div>
    </div>
  );
}
