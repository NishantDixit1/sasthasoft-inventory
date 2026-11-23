/**
 * Deterministic formatters. Money is stored as integer paise everywhere so that
 * totals never drift through floating point; it is only turned into a string here.
 * Dates are formatted by hand rather than with toLocaleDateString so the server
 * and the browser always produce the same markup.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** 1234567 -> "12,34,567" (Indian digit grouping) */
function groupIndian(value: string): string {
  const [whole, fraction] = value.split(".");
  const negative = whole.startsWith("-");
  const digits = negative ? whole.slice(1) : whole;
  let out: string;
  if (digits.length <= 3) {
    out = digits;
  } else {
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3);
    out = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  }
  return (negative ? "-" : "") + out + (fraction ? "." + fraction : "");
}

/** paise -> "₹1,24,500" */
export function money(paise: number, opts: { decimals?: boolean; sign?: boolean } = {}): string {
  const rupees = paise / 100;
  const fixed = rupees.toFixed(opts.decimals ? 2 : 0);
  const prefix = opts.sign && paise > 0 ? "+" : "";
  return prefix + "₹" + groupIndian(fixed);
}

/** paise -> "₹1.2L" / "₹12.4K" for dense dashboard tiles */
export function moneyCompact(paise: number): string {
  const rupees = Math.abs(paise) / 100;
  const sign = paise < 0 ? "-" : "";
  if (rupees >= 1_00_00_000) return `${sign}₹${(rupees / 1_00_00_000).toFixed(2)}Cr`;
  if (rupees >= 1_00_000) return `${sign}₹${(rupees / 1_00_000).toFixed(2)}L`;
  if (rupees >= 1_000) return `${sign}₹${(rupees / 1_000).toFixed(1)}K`;
  return `${sign}₹${Math.round(rupees)}`;
}

export function number(value: number): string {
  return groupIndian(String(Math.round(value)));
}

export function percent(value: number, decimals = 1): string {
  return `${value >= 0 ? "" : ""}${value.toFixed(decimals)}%`;
}

/** "2026-11-14" -> "14 Nov 2026" */
export function date(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "2026-11-14" -> "14 Nov" */
export function dateShort(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function dateTime(iso: string): string {
  const d = new Date(iso);
  const hours = d.getHours();
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${date(iso)}, ${h12}:${mins} ${hours < 12 ? "am" : "pm"}`;
}

export function monthLabel(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

/** Coarse relative time, for activity feeds */
export function relative(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  return date(iso);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function titleCase(value: string): string {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
