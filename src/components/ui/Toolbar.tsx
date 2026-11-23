"use client";

import type { ReactNode } from "react";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

/** Search box plus filter controls, shared by every list page. */
export function Toolbar({
  query,
  onQueryChange,
  placeholder = "Search",
  children,
  trailing,
  className,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder?: string;
  children?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-line px-5 py-3.5 lg:flex-row lg:items-center",
        className,
      )}
    >
      <div className="relative flex-1 lg:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-8 text-sm text-ink placeholder:text-subtle transition-colors hover:border-line-strong focus:border-brand focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]"
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-subtle transition-colors hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {trailing ? <div className="lg:ml-auto">{trailing}</div> : null}
    </div>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const active = value !== "all";
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-9 cursor-pointer appearance-none rounded-lg border bg-surface pl-3 pr-8 text-[13px] transition-colors focus:border-brand focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]",
          active
            ? "border-brand/40 bg-brand-soft text-brand font-medium"
            : "border-line text-muted hover:border-line-strong hover:text-ink",
        )}
      >
        <option value="all">{label}: All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 16 16"
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-70"
      >
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
