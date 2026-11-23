"use client";

import { useRef, useState } from "react";

import { moneyCompact, money } from "@/lib/format";
import type { SeriesPoint } from "@/lib/selectors";

const WIDTH = 860;
const HEIGHT = 260;
const PAD = { top: 16, right: 16, bottom: 28, left: 56 };

/**
 * Sales against purchases over time. Written as plain SVG so the chart picks up
 * the same design tokens as the rest of the UI and adds no runtime dependency.
 */
export function TrendChart({ data }: { data: SeriesPoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;

  const peak = Math.max(
    1,
    ...data.map((point) => Math.max(point.sales, point.purchases)),
  );
  // round the axis up to a clean number so the gridlines read well
  const magnitude = Math.pow(10, Math.floor(Math.log10(peak)));
  const top = Math.ceil(peak / magnitude) * magnitude;

  const x = (index: number) =>
    PAD.left + (data.length <= 1 ? innerWidth / 2 : (index / (data.length - 1)) * innerWidth);
  const y = (value: number) => PAD.top + innerHeight - (value / top) * innerHeight;

  const line = (pick: (point: SeriesPoint) => number) =>
    data.map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(pick(point))}`).join(" ");

  const area = (pick: (point: SeriesPoint) => number) =>
    `${line(pick)} L${x(data.length - 1)},${PAD.top + innerHeight} L${x(0)},${PAD.top + innerHeight} Z`;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    value: top * ratio,
    y: PAD.top + innerHeight - ratio * innerHeight,
  }));

  function handleMove(event: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const bounds = svg.getBoundingClientRect();
    const localX = ((event.clientX - bounds.left) / bounds.width) * WIDTH;
    const ratio = (localX - PAD.left) / innerWidth;
    const index = Math.round(ratio * (data.length - 1));
    setHover(index >= 0 && index < data.length ? index : null);
  }

  const active = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="Sales against purchases over time"
      >
        <defs>
          <linearGradient id="trend-sales" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="trend-purchases" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--info)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--info)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={tick.y}
              y2={tick.y}
              stroke="var(--line)"
              strokeWidth="1"
              strokeDasharray={tick.value === 0 ? undefined : "3 5"}
            />
            <text
              x={PAD.left - 10}
              y={tick.y + 4}
              textAnchor="end"
              className="fill-[var(--ink-subtle)] text-[11px]"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {moneyCompact(tick.value)}
            </text>
          </g>
        ))}

        <path d={area((point) => point.purchases)} fill="url(#trend-purchases)" />
        <path d={area((point) => point.sales)} fill="url(#trend-sales)" />

        <path
          d={line((point) => point.purchases)}
          fill="none"
          stroke="var(--info)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="5 4"
        />
        <path
          d={line((point) => point.sales)}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {data.map((point, index) =>
          index % Math.ceil(data.length / 7) === 0 || index === data.length - 1 ? (
            <text
              key={point.key}
              x={x(index)}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-[var(--ink-subtle)] text-[11px]"
            >
              {point.label}
            </text>
          ) : null,
        )}

        {active ? (
          <g>
            <line
              x1={x(hover!)}
              x2={x(hover!)}
              y1={PAD.top}
              y2={PAD.top + innerHeight}
              stroke="var(--line-strong)"
              strokeWidth="1"
            />
            <circle cx={x(hover!)} cy={y(active.purchases)} r="4" fill="var(--info)" />
            <circle cx={x(hover!)} cy={y(active.sales)} r="4.5" fill="var(--brand)" />
          </g>
        ) : null}
      </svg>

      {active ? (
        <div
          className="pointer-events-none absolute top-2 rounded-lg border border-line bg-surface px-3 py-2 shadow-md"
          style={{
            left: `calc(${(x(hover!) / WIDTH) * 100}% + 8px)`,
            transform: hover! > data.length / 2 ? "translateX(-110%)" : undefined,
          }}
        >
          <p className="text-[11px] font-medium text-subtle">{active.label}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[12px] text-ink tnum">
            <span className="h-2 w-2 rounded-full bg-brand" />
            Sales {money(active.sales)}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink tnum">
            <span className="h-2 w-2 rounded-full bg-info" />
            Purchases {money(active.purchases)}
          </p>
        </div>
      ) : null}

      <div className="mt-2 flex items-center gap-4 pl-14">
        <span className="flex items-center gap-1.5 text-[12px] text-muted">
          <span className="h-0.5 w-4 rounded-full bg-brand" /> Sales
        </span>
        <span className="flex items-center gap-1.5 text-[12px] text-muted">
          <span className="h-0.5 w-4 rounded-full bg-info" /> Purchases
        </span>
      </div>
    </div>
  );
}
