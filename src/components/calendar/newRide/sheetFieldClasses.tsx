// Shared field-primitive classes for the Nova vožnja v2 sheet (§2) — kept
// in one place so every plain input/textarea in this sheet matches exactly.
// Also reused by CityCombobox and ClientCombobox (imported directly rather
// than re-declared) so their "sheet" variants always stay in sync with this
// one source of truth.
export const SHEET_INPUT_CLASS =
  "h-10 w-full rounded-control px-3 text-[14px] text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] shadow-[inset_0_0_0_1px_var(--border-control)] transition-shadow duration-[.12s] ease-out focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--action-bg),0_0_0_3px_var(--action-100)]";

export const SHEET_INPUT_ERROR_CLASS =
  "h-10 w-full rounded-control px-3 text-[14px] text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] shadow-[inset_0_0_0_1px_var(--ink-destructive-ring)] transition-shadow duration-[.12s] ease-out focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--action-bg),0_0_0_3px_var(--action-100)]";

export const SHEET_TEXTAREA_CLASS =
  "w-full min-h-16 rounded-control px-3 py-[10px] text-[14px] text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] shadow-[inset_0_0_0_1px_var(--border-control)] transition-shadow duration-[.12s] ease-out focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--action-bg),0_0_0_3px_var(--action-100)] resize-none";

export const SHEET_SELECT_CLASS =
  "h-10 w-full appearance-none rounded-control pl-3 pr-9 text-[14px] text-[var(--ink-primary)] shadow-[inset_0_0_0_1px_var(--border-control)] transition-shadow duration-[.12s] ease-out focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--action-bg),0_0_0_3px_var(--action-100)]";

export const SHEET_LABEL_CLASS = "block text-[13px] font-medium text-[var(--ink-2)]";

export const SHEET_TEXT_BUTTON_CLASS =
  "-ml-2 flex h-7 items-center gap-[6px] rounded-chip px-2 text-[13px] font-medium text-[var(--action-bg)] transition-colors duration-[.12s] ease-out hover:bg-[var(--select-tint)]";

// Combobox suggestion dropdowns (CityCombobox, ClientCombobox) — shared so
// the two don't drift from each other (they previously had slightly
// different max-heights and independently hand-rolled hex colors).
export const SHEET_DROPDOWN_CLASS =
  "absolute left-0 top-full z-10 mt-1 max-h-56 w-full overflow-auto rounded-control bg-white py-1 text-[14px] shadow-[var(--shadow-card)] ring-1 ring-[var(--border-soft)]";
export const SHEET_OPTION_CLASS = "block w-full px-3 py-[7px] text-left text-[var(--ink-2)] hover:bg-[var(--border-soft)]";
export const DEFAULT_DROPDOWN_CLASS =
  "absolute left-0 top-full z-10 mt-1 max-h-56 w-full overflow-auto rounded-chip border border-[var(--border-control)] bg-white py-1 text-sm shadow-[var(--shadow-card)]";
export const DEFAULT_OPTION_CLASS = "block w-full px-3 py-1.5 text-left text-[var(--ink-body)] hover:bg-[var(--border-soft)]";

// The custom chevron paired with SHEET_SELECT_CLASS's `appearance-none` —
// a native <select>'s own arrow renders inconsistently across browsers and
// doesn't line up with this sheet's input height/padding, so every select
// in this design hides it and draws this one instead. Must sit inside a
// `relative` wrapper around the <select>.
export function SheetChevronIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={14}
      height={14}
      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]"
      fill="none"
      aria-hidden="true"
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
