"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const noop = () => () => {};

/**
 * The entire dataset lives in the browser and every figure is relative to the
 * current date, so there is nothing stable to prerender. The app frame renders
 * on the server and the data renders once mounted, which keeps the markup the
 * server sends and the markup React hydrates identical.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return <>{useMounted() ? children : fallback}</>;
}
