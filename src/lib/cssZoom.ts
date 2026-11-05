// The carrier app renders at a slightly smaller CSS `zoom` on laptop-size
// screens (see `.app-scale` in globals.css). getBoundingClientRect() reports
// on-screen (already zoomed) pixels, but a fixed-position element's
// top/left inside the zoomed page get scaled again by that same zoom — so
// anything positioned from a measured rect has to divide by it first, or it
// lands short of its trigger.
export function rootZoom(): number {
  if (typeof window === "undefined") return 1;
  const zoom = parseFloat(getComputedStyle(document.documentElement).zoom);
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

// Converts an on-screen position (from getBoundingClientRect) into the CSS
// pixels a fixed-position element needs to appear at that same spot.
export function toZoomedPosition(position: { top: number; left: number }) {
  const zoom = rootZoom();
  return { top: position.top / zoom, left: position.left / zoom };
}
