import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Read-only line item table used inside the detail drawers. */
export function LinesTable({
  columns,
  children,
}: {
  columns: { key: string; label: ReactNode; align?: "left" | "right" }[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2/70">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "px-3 py-2 text-[11.5px] font-medium uppercase tracking-[0.04em] text-subtle",
                    column.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}
