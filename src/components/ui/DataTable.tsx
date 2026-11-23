"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "./Button";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  /** supplying a comparator makes the column sortable */
  sort?: (a: T, b: T) => number;
  className?: string;
  headerClassName?: string;
}

/**
 * The one table used by every module. Sorting and paging are kept inside;
 * filtering stays with the page, which owns the filter controls.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  empty,
  pageSize = 10,
  initialSort,
  dense = false,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  pageSize?: number;
  initialSort?: { key: string; direction: "asc" | "desc" };
  dense?: boolean;
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sort) return rows;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => column.sort!(a, b) * factor);
  }, [rows, columns, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const visible = sorted.slice(current * pageSize, current * pageSize + pageSize);

  function toggleSort(key: string) {
    setPage(0);
    setSort((previous) => {
      if (previous?.key !== key) return { key, direction: "asc" };
      if (previous.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }

  const alignment = {
    left: "text-left",
    right: "text-right",
    center: "text-center",
  } as const;

  if (rows.length === 0) {
    return <div>{empty}</div>;
  }

  return (
    <div>
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2/60">
              {columns.map((column) => {
                const active = sort?.key === column.key;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      "px-4 py-2.5 text-[12px] font-medium uppercase tracking-[0.04em] text-subtle",
                      alignment[column.align ?? "left"],
                      column.headerClassName,
                    )}
                  >
                    {column.sort ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className={cn(
                          "inline-flex items-center gap-1 uppercase tracking-[0.04em] transition-colors hover:text-ink",
                          active && "text-ink",
                          column.align === "right" && "flex-row-reverse",
                        )}
                      >
                        {column.header}
                        {active ? (
                          sort!.direction === "asc" ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )
                        ) : (
                          <ChevronsNeutral />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === "Enter") onRowClick(row);
                      }
                    : undefined
                }
                className={cn(
                  "border-b border-line/70 last:border-0 transition-colors",
                  onRowClick && "cursor-pointer hover:bg-surface-2/70",
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-4 align-middle text-ink",
                      dense ? "py-2" : "py-3",
                      alignment[column.align ?? "left"],
                      column.className,
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length > pageSize ? (
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
          <p className="text-[12px] text-muted tnum">
            {current * pageSize + 1} to{" "}
            {Math.min(sorted.length, current * pageSize + pageSize)} of {sorted.length}
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              size="icon"
              variant="secondary"
              onClick={() => setPage(current - 1)}
              disabled={current === 0}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-1 text-[12px] text-muted tnum">
              {current + 1} / {pageCount}
            </span>
            <Button
              size="icon"
              variant="secondary"
              onClick={() => setPage(current + 1)}
              disabled={current >= pageCount - 1}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChevronsNeutral() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3 text-subtle/60">
      <path d="M6 2l2.5 3h-5L6 2z" fill="currentColor" />
      <path d="M6 10l-2.5-3h5L6 10z" fill="currentColor" />
    </svg>
  );
}
