"use client";

import { useState } from "react";

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  display: string;
}

const COLORS = [
  "var(--brand)",
  "var(--info)",
  "var(--success)",
  "var(--warning)",
  "var(--danger)",
];

/** Composition of stock value, drawn with dash offsets on a single circle. */
export function DonutChart({
  slices,
  centerLabel,
  centerValue,
}: {
  slices: DonutSlice[];
  centerLabel: string;
  centerValue: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  /** start angle for each slice, as a dash offset around the ring */
  const arcs = slices.reduce<{ slice: DonutSlice; length: number; offset: number }[]>(
    (rows, slice) => {
      const previous = rows[rows.length - 1];
      const offset = previous ? previous.offset + previous.length : 0;
      return [...rows, { slice, length: (slice.value / total) * circumference, offset }];
    },
    [],
  );

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative h-[156px] w-[156px] shrink-0">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="var(--surface-3)"
            strokeWidth="18"
          />
          {arcs.map(({ slice, length, offset }, index) => (
            <circle
              key={slice.key}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={hover === slice.key ? 22 : 18}
              strokeDasharray={`${Math.max(0, length - 2)} ${circumference - Math.max(0, length - 2)}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              className="transition-all duration-200"
              onMouseEnter={() => setHover(slice.key)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-subtle">
            {centerLabel}
          </p>
          <p className="mt-0.5 text-[17px] font-semibold text-ink tnum">{centerValue}</p>
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-1.5">
        {slices.map((slice, index) => (
          <li
            key={slice.key}
            onMouseEnter={() => setHover(slice.key)}
            onMouseLeave={() => setHover(null)}
            className="flex items-center justify-between gap-3 rounded-md px-1.5 py-1 transition-colors hover:bg-surface-2"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: COLORS[index % COLORS.length] }}
              />
              <span className="truncate text-[13px] text-ink">{slice.label}</span>
            </span>
            <span className="shrink-0 text-[13px] font-medium text-muted tnum">
              {slice.display}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
