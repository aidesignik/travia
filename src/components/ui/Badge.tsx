const colorByTone: Record<string, string> = {
  neutral: "bg-[var(--chip-neutral)]",
  positive: "bg-[var(--chip-positive)]",
  warning: "bg-[var(--chip-warning)]",
  negative: "bg-[var(--chip-critical)]",
  info: "bg-[var(--chip-info)]",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "positive" | "warning" | "negative" | "info";
}) {
  return (
    <span
      className={`inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-[11px] py-[5px] text-[12px] font-semibold text-[var(--chip-ink)] ${colorByTone[tone]}`}
    >
      {children}
    </span>
  );
}
