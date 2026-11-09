"use client";

import { useSyncExternalStore } from "react";

// Whether the assistant chat is pinned to the right edge. Shared with
// SidePanel: while pinned, ride details and the ride/vehicle/driver forms open
// in that same right column (over the chat, with a way back to it) instead of
// sliding in on top of the calendar, so the calendar keeps one width.

/** Width of the pinned column, in CSS px (before the app's 90% zoom). */
export const ASSISTANT_DOCK_WIDTH = 460;
/** Gap between the pinned column and the window edge, matching the shell's p-2. */
export const ASSISTANT_DOCK_GAP = 8;

let docked = false;
const listeners = new Set<() => void>();

export function setAssistantDocked(value: boolean) {
  if (docked === value) return;
  docked = value;
  // The app shell reserves this much room on the right (see the carrier
  // layout), so the calendar narrows instead of being covered.
  document.documentElement.style.setProperty(
    "--assistant-dock",
    value ? `${ASSISTANT_DOCK_WIDTH + ASSISTANT_DOCK_GAP}px` : "0px",
  );
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAssistantDocked(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => docked,
    () => false,
  );
}
