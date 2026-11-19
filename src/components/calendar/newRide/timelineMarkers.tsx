// §5.1 route-list markers (Maps-directions style): origin and stops share a
// ring marker, only the destination (and a locked return-leg end) gets the
// filled pin. The connector between rows is three stacked dots, not a line.
export function RingMarker() {
  return (
    <span
      className="block h-[10px] w-[10px] shrink-0 rounded-full bg-white"
      style={{ border: "2px solid var(--ink-body)" }}
    />
  );
}

// A filled pin with a hollow (punched-out) center, per spec.
export function PinMarker() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" className="shrink-0">
      <path
        d="M8 1.5C5.42 1.5 3.33 3.6 3.33 6.17c0 3.73 4.1 7.78 4.27 7.95a.56.56 0 0 0 .8 0c.17-.17 4.27-4.22 4.27-7.95C12.67 3.6 10.58 1.5 8 1.5Z"
        fill="var(--ink-primary)"
      />
      <circle cx="8" cy="6.2" r="2" fill="white" />
    </svg>
  );
}

// 3 stacked 2×2 dots, centered in the marker column — the row-to-row
// connector for the new route-list pattern (replaces a solid line).
export function DotConnector() {
  return (
    <div className="flex flex-col items-center gap-[3px] py-[3px]">
      <span className="h-[2px] w-[2px] rounded-full bg-[var(--ink-disabled)]" />
      <span className="h-[2px] w-[2px] rounded-full bg-[var(--ink-disabled)]" />
      <span className="h-[2px] w-[2px] rounded-full bg-[var(--ink-disabled)]" />
    </div>
  );
}
