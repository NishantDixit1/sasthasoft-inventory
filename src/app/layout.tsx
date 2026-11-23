import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";

import { AppShell } from "@/components/layout/AppShell";
import { themeScript } from "@/components/layout/ThemeToggle";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "SasthaSoft Inventory",
    template: "%s · SasthaSoft Inventory",
  },
  description:
    "Inventory management across sales, purchase, stock and reporting, with every movement tied back to a single stock ledger.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // the theme script adds the `dark` class before React hydrates, so the
    // class list on <html> is expected to differ from the server markup
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full">
        <Script id="theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
