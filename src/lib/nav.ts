import {
  Boxes,
  Building2,
  FileBarChart,
  LayoutDashboard,
  ReceiptIndianRupee,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: typeof Boxes;
  /** show the live low stock count against this entry */
  alerts?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    title: "Operations",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/sales", label: "Sales", icon: ReceiptIndianRupee },
      { href: "/purchases", label: "Purchase", icon: Truck },
      { href: "/stock", label: "Stock", icon: Boxes, alerts: true },
      { href: "/reports", label: "Reports", icon: FileBarChart },
    ],
  },
  {
    title: "Masters",
    items: [
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/suppliers", label: "Suppliers", icon: Building2 },
      { href: "/godowns", label: "Godowns", icon: Warehouse },
    ],
  },
];

/** Longest matching nav entry, so /stock/it-01 still highlights Stock. */
export function activeHref(pathname: string): string {
  const all = NAV.flatMap((section) => section.items.map((item) => item.href));
  return all
    .filter((href) => (href === "/" ? pathname === "/" : pathname.startsWith(href)))
    .sort((a, b) => b.length - a.length)[0] ?? "/";
}
