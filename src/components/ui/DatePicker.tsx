"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import {
  formatPickerDate,
  formatPickerMonthYear,
  formatPickerWeekday,
  parseDateOnly,
  toDateOnlyString,
} from "@/lib/pickerDateFormat";

export interface DatePickerHandle {
  open: () => void;
}

// Custom calendar popover (§2 Date field) — works on a plain "YYYY-MM-DD"
// string, same value shape the rest of the form already combines into the
// datetime-local string it sends on submit; this only changes how that
// value is picked, not what it is.
export const DatePicker = forwardRef<
  DatePickerHandle,
  {
    value: string;
    onChange: (date: string) => void;
    minDate?: string;
    placeholder?: string;
    error?: boolean;
  }
>(function DatePicker({ value, onChange, minDate, placeholder, error }, ref) {
  const locale = useLocale();
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const selected = parseDateOnly(value);
  const minD = minDate ? parseDateOnly(minDate) : null;
  const [viewDate, setViewDate] = useState(() => selected ?? minD ?? new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
  }));

  useEffect(() => {
    if (open) setViewDate(selected ?? minD ?? new Date());
    // Only when the popover opens — not on every keystroke/value change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const minStr = minD ? toDateOnlyString(minD) : null;
  const selectedStr = selected ? toDateOnlyString(selected) : null;
  const todayStr = toDateOnlyString(new Date());

  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    formatPickerWeekday(new Date(2024, 0, 1 + i), locale),
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-10 w-full items-center gap-2 rounded-control px-3 text-left text-[14px] transition-shadow duration-[.12s] ease-out focus:outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--action-bg),0_0_0_3px_var(--action-100)] ${
          error ? "shadow-[inset_0_0_0_1px_var(--ink-destructive-ring)]" : "shadow-[inset_0_0_0_1px_var(--border-control)]"
        }`}
      >
        <Calendar size={15} className="shrink-0 text-[var(--ink-muted)]" />
        <span className={selected ? "truncate text-[var(--ink-primary)]" : "truncate text-[var(--ink-muted)]"}>
          {selected ? formatPickerDate(selected, locale) : placeholder}
        </span>
      </button>
      {open ? (
        <div className="absolute z-20 mt-1 w-[280px] rounded-panel bg-white p-3 shadow-[var(--shadow-card)] ring-1 ring-[var(--border-soft)]">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
              aria-label={t("previousMonth")}
              className="flex h-7 w-7 items-center justify-center rounded-chip text-[var(--ink-secondary)] hover:bg-[var(--border-soft)]"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <span className="text-[14px] font-semibold text-[var(--ink-primary)]">
              {formatPickerMonthYear(viewDate, locale)}
            </span>
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              aria-label={t("nextMonth")}
              className="flex h-7 w-7 items-center justify-center rounded-chip text-[var(--ink-secondary)] hover:bg-[var(--border-soft)]"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-y-1 text-center">
            {weekdayLabels.map((w, i) => (
              <span key={i} className="text-[11px] font-medium text-[var(--ink-muted)]">
                {w}
              </span>
            ))}
            {cells.map((d, i) => {
              if (!d) return <span key={i} />;
              const str = toDateOnlyString(d);
              const disabled = minStr !== null && str < minStr;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(str);
                    setOpen(false);
                  }}
                  className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[13px] tabular-nums transition-colors duration-[.12s] ease-out ${
                    str === selectedStr
                      ? "bg-[var(--action-bg)] font-semibold text-white"
                      : disabled
                        ? "cursor-not-allowed text-[var(--ink-disabled)]"
                        : str === todayStr
                          ? "font-semibold text-[var(--action-bg)] hover:bg-[var(--select-tint)]"
                          : "text-[var(--ink-2)] hover:bg-[var(--border-soft)]"
                  }`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
});
