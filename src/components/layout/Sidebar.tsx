"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

import { ClientOnly } from "./ClientOnly";
import { Button } from "@/components/ui/Button";
import { activeHref, NAV } from "@/lib/nav";
import { useLowStock } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const active = activeHref(pathname);

  const alerts = useLowStock().length;

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-overlay backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-line bg-surface",
          "transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-line px-4">
          <Link href="/" className="flex items-center gap-2.5" onClick={onClose}>
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand text-white shadow-xs">
              <Logo />
            </span>
            <span className="leading-tight">
              <span className="block text-[14.5px] font-semibold tracking-[-0.01em] text-ink">
                SasthaSoft
              </span>
              <span className="block text-[11.5px] text-subtle">Inventory Suite</span>
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
          {NAV.map((section) => (
            <div key={section.title} className="mb-5 last:mb-0">
              <p className="mb-1.5 px-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = active === item.href;
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors",
                          isActive
                            ? "bg-brand-soft text-brand"
                            : "text-muted hover:bg-surface-2 hover:text-ink",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-[17px] w-[17px] shrink-0",
                            isActive ? "text-brand" : "text-subtle group-hover:text-ink",
                          )}
                        />
                        <span className="flex-1">{item.label}</span>
                        {item.alerts ? (
                          <ClientOnly>
                            {alerts > 0 ? (
                              <span className="rounded-full bg-danger-soft px-1.5 py-0.5 text-[11px] font-semibold text-danger tnum">
                                {alerts}
                              </span>
                            ) : null}
                          </ClientOnly>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-3 text-[11px] font-semibold text-muted">
              MR
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[13px] font-medium text-ink">Meena R</span>
              <span className="block truncate text-[11.5px] text-subtle">Stock Controller</span>
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
      <path
        d="M12 3l7.5 4.2v8.6L12 20l-7.5-4.2V7.2L12 3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M4.8 7.4L12 11.5l7.2-4.1M12 11.5V20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
