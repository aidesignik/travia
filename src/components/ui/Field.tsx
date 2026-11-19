import { ReactNode } from "react";

export function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: ReactNode;
  error?: string;
}) {
  return (
    <label className="block space-y-[5px]">
      <span className="block text-[13px] font-semibold text-[var(--ink-2)]">{label}</span>
      {children}
      {error ? <span className="block text-[13px] text-[var(--ink-destructive)]">{error}</span> : null}
    </label>
  );
}
