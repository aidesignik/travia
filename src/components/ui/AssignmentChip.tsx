import type { ReactNode } from "react";

// A filled assignment (driver <-> vehicle pairing) — solid pill so it reads
// as a normal, positive piece of data, not a warning.
export function AssignmentChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--border-soft)] py-1 pl-1 pr-2.5 text-xs font-medium text-[var(--ink-body)]">
      {children}
    </span>
  );
}

// No pairing set — a normal, expected state (assignment is optional), so
// this is deliberately low-emphasis: a dashed outline, not styled like a
// warning or error.
export function EmptyAssignmentChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-dashed border-[var(--border-strong)] px-2.5 py-1 text-xs text-[var(--ink-muted)]">
      {children}
    </span>
  );
}
