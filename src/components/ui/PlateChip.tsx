import { formatPlate } from "@/lib/plateDisplay";

// Shared license-plate chip — every place a plate is shown (calendar row
// labels, Vozni park, Vozači, Rezervacije) renders it through this so it
// always looks identical.
export function PlateChip({ plate, className }: { plate: string; className?: string }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-chip px-[6px] py-[1px] font-mono text-[12px] ${className ?? ""}`}
      style={{ background: "var(--plate-bg)", color: "var(--plate-ink)" }}
    >
      {formatPlate(plate)}
    </span>
  );
}
