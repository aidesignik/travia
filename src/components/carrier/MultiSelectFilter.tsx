"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Check, X } from "lucide-react";

export interface MultiSelectOption {
  value: string;
  label: string;
  // Number of items in the currently visible set that match this option —
  // shown right-aligned in its row. A 0 count dims the row (label + count
  // only) without disabling it; it's still a real filter you can select.
  count: number;
  // CSS color for the row's 6px status dot. Omit for a filter dimension
  // that has no natural dot color — the row just skips the dot.
  dotColor?: string;
}

const ACCENT = "#2563EB";

// Shared multi-select filter trigger + menu — Status on Calendar,
// Rezervacije, Vozni park and Vozači all render through this so the
// trigger's active/cleared look and the menu's row/footer layout can
// never drift between the four pages. Selection and filtering are fully
// owned by the caller (this component is just the control); each page
// decides how "selected" maps to its own data and how it's kept in the
// URL.
export function MultiSelectFilter({
  label,
  clearLabel,
  options,
  selected,
  onChange,
  align = "left",
}: {
  label: string;
  clearLabel: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  // Which edge of the trigger the menu lines up with — "right" for a
  // trigger near the right edge of a clipping container, so the 240px menu
  // opens leftwards instead of being cut off.
  align?: "left" | "right";
}) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const groupRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const hasSelection = selected.length > 0;
  const selectedOptions = options.filter((o) => selected.includes(o.value));
  const triggerText =
    selectedOptions.length === 0
      ? label
      : selectedOptions.length === 1
        ? `${label}: ${selectedOptions[0].label}`
        : `${label}: ${selectedOptions[0].label} +${selectedOptions.length - 1}`;

  function close() {
    setOpen(false);
  }

  function closeAndRefocus() {
    close();
    triggerRef.current?.focus();
  }

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (groupRef.current && !groupRef.current.contains(event.target as Node)) close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAndRefocus();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((i) => Math.min(options.length - 1, i + 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      } else if (event.key === " ") {
        event.preventDefault();
        const opt = options[activeIndex];
        if (opt) toggle(opt.value);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, options, activeIndex, selected]);

  return (
    <div ref={groupRef} className="relative inline-block">
      <div
        className="flex h-10 items-center rounded-[8px] border transition-colors duration-[.12s] ease-out"
        style={
          hasSelection
            ? { background: "rgba(37,99,235,.08)", borderColor: "transparent" }
            : { borderColor: "var(--border-control)" }
        }
      >
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => {
            setOpen((v) => !v);
            setActiveIndex(0);
          }}
          className={`flex h-full items-center gap-[6px] rounded-l-[8px] pl-[14px] text-[13.5px] font-medium ${
            hasSelection ? "pr-[6px]" : "pr-[14px] text-[var(--ink-body)] hover:bg-[var(--border-soft)]"
          }`}
          style={hasSelection ? { color: ACCENT } : undefined}
        >
          <span className="max-w-[220px] truncate">{triggerText}</span>
          {hasSelection ? null : <ChevronDown size={13} strokeWidth={1.9} />}
        </button>
        {hasSelection ? (
          <button
            type="button"
            aria-label={clearLabel}
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
            className="flex h-full items-center rounded-r-[8px] pr-[10px] pl-[2px]"
            style={{ color: ACCENT }}
          >
            <X size={13} strokeWidth={2.2} />
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          role="listbox"
          aria-multiselectable="true"
          style={{ minWidth: 240 }}
          className={`absolute ${align === "right" ? "right-0" : "left-0"} z-[70] mt-1 rounded-[12px] bg-[var(--bg-panel)] p-2 shadow-[var(--shadow-card)] ring-1 ring-[var(--border-hairline)]`}
        >
          {options.map((opt, i) => {
            const isSelected = selected.includes(opt.value);
            const isZero = opt.count === 0;
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                onClick={() => toggle(opt.value)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`group flex h-9 cursor-pointer items-center gap-[8px] rounded-[8px] px-[8px] ${
                  i === activeIndex ? "bg-[var(--border-soft)]" : ""
                }`}
              >
                <span
                  aria-hidden
                  className="flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-[4px] border"
                  style={
                    isSelected
                      ? { background: ACCENT, borderColor: ACCENT }
                      : { borderColor: "var(--border-strong)" }
                  }
                >
                  {isSelected ? <Check size={10} strokeWidth={3} color="#fff" /> : null}
                </span>
                {opt.dotColor ? (
                  <span
                    aria-hidden
                    className="h-[6px] w-[6px] shrink-0 rounded-full"
                    style={{ background: opt.dotColor }}
                  />
                ) : null}
                <span
                  className={`min-w-0 flex-1 truncate text-[13.5px] text-[var(--ink-body)] ${isZero ? "opacity-50" : ""}`}
                >
                  {opt.label}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange([opt.value]);
                  }}
                  className="hidden shrink-0 text-[11.5px] font-semibold hover:underline group-hover:inline-block"
                  style={{ color: ACCENT }}
                >
                  {t("only")}
                </button>
                <span className={`shrink-0 text-[12.5px] text-[var(--ink-muted)] ${isZero ? "opacity-50" : ""}`}>
                  {opt.count}
                </span>
              </div>
            );
          })}
          <div className="mt-1 flex items-center justify-between border-t border-[var(--border-hairline)] px-[8px] pt-2">
            <button
              type="button"
              disabled={!hasSelection}
              onClick={() => onChange([])}
              className="text-[12.5px] font-semibold disabled:cursor-not-allowed disabled:text-[var(--ink-disabled)]"
              style={hasSelection ? { color: ACCENT } : undefined}
            >
              {t("clear")}
            </button>
            <span className="text-[12.5px] text-[var(--ink-muted)]">{selected.length}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
