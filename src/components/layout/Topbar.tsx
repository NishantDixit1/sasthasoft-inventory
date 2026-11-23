"use client";

import { useEffect, useState } from "react";
import { Menu, RotateCcw, Search } from "lucide-react";

import { CommandPalette } from "./CommandPalette";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import { useApp } from "@/lib/store";

export function Topbar({ onOpenNav }: { onOpenNav: () => void }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const resetDemo = useApp((state) => state.resetDemo);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/80 px-4 backdrop-blur-md sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenNav}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="group flex h-9 w-full max-w-sm items-center gap-2.5 rounded-lg border border-line bg-surface-2 px-3 text-left transition-colors hover:border-line-strong hover:bg-surface"
      >
        <Search className="h-4 w-4 shrink-0 text-subtle" />
        <span className="flex-1 truncate text-[13px] text-subtle">
          Search items, orders, customers
        </span>
        <kbd className="hidden shrink-0 rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10.5px] text-subtle sm:block">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          icon={<RotateCcw className="h-3.5 w-3.5" />}
          onClick={() => {
            resetDemo();
            toast.info("Sample data restored", "Every module is back to its starting state.");
          }}
          title="Restore the sample dataset"
        >
          <span className="hidden sm:inline">Reset data</span>
        </Button>
        <ThemeToggle />
      </div>

      {paletteOpen ? <CommandPalette onClose={() => setPaletteOpen(false)} /> : null}
    </header>
  );
}
