import type { RideStatus } from "./types";

// One accent colour per ride status — used for the toolbar legend dot.
export const RIDE_STATUS_ACCENT: Record<RideStatus, string> = {
  PENDING: "var(--accent-pending)",
  CONFIRMED: "var(--action-bg)",
  COMPLETED: "var(--accent-completed)",
  CANCELLED: "var(--status-cancelled-dot)",
};

// Ride card fill per status — the card's whole background carries its
// status (see --status-*-bg tokens in globals.css) instead of an accent bar.
export const RIDE_STATUS_BG: Record<RideStatus, string> = {
  PENDING: "var(--status-pending-bg)",
  CONFIRMED: "var(--status-confirmed-bg)",
  COMPLETED: "var(--status-completed-bg)",
  CANCELLED: "var(--status-cancelled-bg)",
};

// Saturated pairing of RIDE_STATUS_BG (see --status-*-dot tokens in
// globals.css) — for small elements where the soft fill reads too faint,
// e.g. the toolbar legend dots and the ride card's status tag dot.
export const RIDE_STATUS_DOT: Record<RideStatus, string> = {
  PENDING: "var(--status-pending-dot)",
  CONFIRMED: "var(--status-confirmed-dot)",
  COMPLETED: "var(--status-completed-dot)",
  CANCELLED: "var(--status-cancelled-dot)",
};

// Darker still (see --status-*-text tokens) — the ride card's status tag
// renders its label in this shade so it reads clearly against both the
// card's own tint and the tag's semi-transparent white pill.
export const RIDE_STATUS_TEXT: Record<RideStatus, string> = {
  PENDING: "var(--status-pending-text)",
  CONFIRMED: "var(--status-confirmed-text)",
  COMPLETED: "var(--status-completed-text)",
  CANCELLED: "var(--status-cancelled-text)",
};
