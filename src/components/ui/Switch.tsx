"use client";

export function Switch({
  checked,
  onChange,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-[.15s] ease-out focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--action-100)] ${
        checked ? "bg-[var(--action-bg)]" : "bg-[var(--border-strong)]"
      }`}
    >
      <span
        className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.15)] transition-transform duration-[.15s] ease-out ${
          checked ? "translate-x-[19px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}
