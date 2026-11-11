"use client";

import { useSyncExternalStore } from "react";

// What the top bar's search holds while the Help page is open — the Help
// page filters its questions by it. null until the field is typed in (the
// page then goes by ?q= in the URL instead).
let query: string | null = null;
const listeners = new Set<() => void>();

export function setHelpQuery(value: string | null) {
  if (query === value) return;
  query = value;
  listeners.forEach((listener) => listener());
}

export function useHelpQuery(): string | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => query,
    () => null,
  );
}
