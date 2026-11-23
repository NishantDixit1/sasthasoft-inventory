"use client";

import { useEffect, useState, type ReactNode } from "react";

import { ClientOnly } from "./ClientOnly";
import { ContentSkeleton } from "./ContentSkeleton";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { Toaster } from "@/components/ui/Toaster";
import { useApp } from "@/lib/store";

export function AppShell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);

  // The store is created on the server as well, so the saved copy in the
  // browser is merged in once after mount rather than during render.
  useEffect(() => {
    void useApp.persist.rehydrate();
  }, []);

  return (
    <div className="min-h-full">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="lg:pl-[248px]">
        <Topbar onOpenNav={() => setNavOpen(true)} />
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
          <ClientOnly fallback={<ContentSkeleton />}>{children}</ClientOnly>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
