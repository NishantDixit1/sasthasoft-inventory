"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Reads a value straight out of the URL and writes it back on change.
 *
 * Keeping the open record and the headline filter in the query string means
 * the dashboard can deep link into a module, the command palette can jump to a
 * record, and any view a user is looking at can be copied out of the address
 * bar. It also keeps these values derived rather than mirrored into state.
 */
export function useQueryState(
  key: string,
  fallback = "",
): [string, (next: string | null) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params.get(key) ?? fallback;

  const setValue = useCallback(
    (next: string | null) => {
      const search = new URLSearchParams(params.toString());
      if (next === null || next === fallback) search.delete(key);
      else search.set(key, next);
      const query = search.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router, key, fallback],
  );

  return [value, setValue];
}
