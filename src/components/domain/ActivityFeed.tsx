import Link from "next/link";
import {
  ArrowLeftRight,
  IndianRupee,
  PackageCheck,
  PackageX,
  ScrollText,
  SlidersHorizontal,
  Truck,
} from "lucide-react";

import { relative } from "@/lib/format";
import type { ActivityEvent, ActivityKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<ActivityKind, { icon: typeof Truck; tone: string }> = {
  "sale.created": { icon: ScrollText, tone: "bg-brand-soft text-brand" },
  "sale.delivered": { icon: PackageCheck, tone: "bg-success-soft text-success" },
  "sale.payment": { icon: IndianRupee, tone: "bg-success-soft text-success" },
  "sale.cancelled": { icon: PackageX, tone: "bg-danger-soft text-danger" },
  "purchase.created": { icon: ScrollText, tone: "bg-info-soft text-info" },
  "purchase.received": { icon: Truck, tone: "bg-info-soft text-info" },
  "purchase.payment": { icon: IndianRupee, tone: "bg-warning-soft text-warning" },
  "purchase.cancelled": { icon: PackageX, tone: "bg-danger-soft text-danger" },
  "stock.adjusted": { icon: SlidersHorizontal, tone: "bg-warning-soft text-warning" },
  "transfer.completed": { icon: ArrowLeftRight, tone: "bg-neutral-soft text-muted" },
};

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  return (
    <ol className="relative">
      <span
        className="absolute bottom-4 left-[15px] top-4 w-px bg-line"
        aria-hidden
      />
      {events.map((event) => {
        const config = ICONS[event.kind];
        const Icon = config.icon;
        const body = (
          <>
            <span
              className={cn(
                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-[var(--surface)]",
                config.tone,
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1 pt-0.5">
              <span className="block truncate text-[13.5px] font-medium text-ink">
                {event.title}
              </span>
              <span className="mt-0.5 block truncate text-[12px] text-muted">
                {event.detail}
              </span>
              <span className="mt-1 block text-[11.5px] text-subtle">
                {relative(event.at)} · {event.actor}
              </span>
            </span>
          </>
        );

        return (
          <li key={event.id}>
            {event.href ? (
              <Link
                href={event.href}
                className="flex gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-surface-2"
              >
                {body}
              </Link>
            ) : (
              <div className="flex gap-3 px-1 py-2">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
