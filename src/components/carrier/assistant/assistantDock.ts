"use client";

import { useSyncExternalStore } from "react";

// Shared assistant window state.
// - open: the sidebar's "Assistant" item toggles it; AssistantWindow renders it.
// - minimized: the window is collapsed to its title bar (still draggable and
//   closable). The sidebar item / ⌘J restore it rather than closing it.
// - docked: whether the chat is pinned to the right edge. Shared with
//   SidePanel: while pinned, ride details and the ride/vehicle/driver forms
//   open in that same right column (over the chat, with a way back to it)
//   instead of sliding in on top of the calendar, so the calendar keeps one
//   width.

/** Width of the pinned column, in CSS px (before the app's 90% zoom). The
 *  column sits flush against the right edge; the shell's own p-2 is the gap. */
export const ASSISTANT_DOCK_WIDTH = 460;

let open = false;
let minimized = false;
let docked = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setAssistantOpen(value: boolean) {
  if (open === value && !minimized) return;
  open = value;
  // Opening or closing always leaves the window expanded for next time.
  minimized = false;
  notify();
}

export function toggleAssistant() {
  // A minimized window is restored, not closed.
  if (open && minimized) setAssistantMinimized(false);
  else setAssistantOpen(!open);
}

export function setAssistantMinimized(value: boolean) {
  if (minimized === value) return;
  minimized = value;
  notify();
}

export function useAssistantMinimized(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => minimized,
    () => false,
  );
}

export function useAssistantOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
}

export function setAssistantDocked(value: boolean) {
  if (docked === value) return;
  docked = value;
  // The app shell reserves this much room on the right (see the carrier
  // layout), so the calendar narrows instead of being covered.
  document.documentElement.style.setProperty(
    "--assistant-dock",
    value ? `${ASSISTANT_DOCK_WIDTH}px` : "0px",
  );
  notify();
}

export function useAssistantDocked(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => docked,
    () => false,
  );
}
