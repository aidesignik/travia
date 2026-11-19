export function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-[7px] text-[14px] text-[var(--ink-strong)]">
      <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
