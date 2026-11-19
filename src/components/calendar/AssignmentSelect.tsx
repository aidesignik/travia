"use client";

import { useEffect, useRef, useState } from "react";
import {
  SHEET_SELECT_CLASS,
  SHEET_DROPDOWN_CLASS,
  SHEET_OPTION_CLASS,
  DEFAULT_DROPDOWN_CLASS,
  DEFAULT_OPTION_CLASS,
  SheetChevronIcon,
} from "./newRide/sheetFieldClasses";

// Mirrors Select.tsx's own DEFAULT_CLASS (not exported from there) so the
// "default" variant's trigger matches a plain <Select> exactly — pr-9
// reserves room for the absolutely-positioned chevron below, same as
// SHEET_SELECT_CLASS does for SheetChevronIcon.
const DEFAULT_TRIGGER_CLASS =
  "flex h-[42px] w-full items-center rounded-control border border-[var(--border-hairline)] bg-[var(--bg-panel)] pl-3 pr-9 text-left text-[14px] text-[var(--ink-primary)] transition-[border-color,box-shadow] duration-[.12s] ease-out focus:outline-none focus:border-[var(--action-bg)] focus:shadow-[var(--focus-ring)]";

// Flipped-up variants of the shared dropdown-panel classes — swap in when
// there isn't room below the trigger (see `openUpward` below).
const SHEET_DROPDOWN_CLASS_UP = SHEET_DROPDOWN_CLASS.replace("top-full", "bottom-full").replace("mt-1", "mb-1");
const DEFAULT_DROPDOWN_CLASS_UP = DEFAULT_DROPDOWN_CLASS.replace("top-full", "bottom-full").replace("mt-1", "mb-1");

// Rough ceiling on the open panel's height — matches the shared dropdown
// classes' max-h-56 (14rem) — used only to decide whether it should open
// upward instead, not an exact measurement.
const PANEL_MAX_HEIGHT_PX = 224;

export interface AssignmentOption {
  id: string;
  label: string;
  // A vehicle/driver that already has an overlapping ride or block — still
  // selectable, just flagged (dimmed, with a muted "already booked" line),
  // since a carrier may deliberately double-book (a long trip plus a quick
  // local run, a standby driver, etc.) and the server's availability check
  // is advisory, not a hard block.
  busy?: boolean;
  // Vehicle doesn't seat the ride's current passenger count — only colors
  // the trigger once this option is actually selected (a full list of
  // mostly-red rows before the carrier has even settled on a headcount
  // reads as broken, not helpful), still selectable either way.
  warn?: boolean;
}

// Custom-styled replacement for a native <select> wherever the picked
// resource (vehicle or driver) might already be booked: a browser's native
// <option> list can't carry a per-row "Already booked" note, so this
// renders the whole list itself instead, styled like the rest of the
// design system's dropdowns (CityCombobox/ClientCombobox/FilterDropdown).
export function AssignmentSelect({
  value,
  onChange,
  options,
  placeholder,
  busyLabel,
  disabled = false,
  variant = "default",
}: {
  value: string;
  onChange: (id: string) => void;
  options: AssignmentOption[];
  placeholder: string;
  busyLabel: string;
  disabled?: boolean;
  variant?: "default" | "sheet";
}) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheet = variant === "sheet";

  function closeAndRefocus() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function toggleOpen() {
    if (!open) {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) {
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        setOpenUpward(spaceBelow < PANEL_MAX_HEIGHT_PX && spaceAbove > spaceBelow);
      }
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeAndRefocus();
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selected = options.find((o) => o.id === value) ?? null;
  const panelClass = sheet
    ? openUpward
      ? SHEET_DROPDOWN_CLASS_UP
      : SHEET_DROPDOWN_CLASS
    : openUpward
      ? DEFAULT_DROPDOWN_CLASS_UP
      : DEFAULT_DROPDOWN_CLASS;

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={toggleOpen}
        className={`${sheet ? SHEET_SELECT_CLASS : DEFAULT_TRIGGER_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
        style={selected?.warn ? { color: "var(--ink-destructive)" } : undefined}
      >
        <span className={`block truncate ${selected ? "" : "text-[var(--ink-muted)]"}`}>
          {selected ? selected.label : placeholder}
        </span>
      </button>
      {sheet ? (
        <SheetChevronIcon />
      ) : (
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
      )}
      {open ? (
        <ul role="listbox" className={panelClass}>
          <li>
            <button
              type="button"
              role="option"
              aria-selected={value === ""}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange("");
                setOpen(false);
              }}
              className={sheet ? SHEET_OPTION_CLASS : DEFAULT_OPTION_CLASS}
            >
              {placeholder}
            </button>
          </li>
          {options.map((opt) => (
            <li key={opt.id}>
              <button
                type="button"
                role="option"
                aria-selected={value === opt.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt.id);
                  setOpen(false);
                }}
                className={`w-full ${opt.busy ? "opacity-50" : ""} ${sheet ? SHEET_OPTION_CLASS : DEFAULT_OPTION_CLASS}`}
              >
                <span className={`block truncate ${sheet ? "text-[var(--ink-primary)]" : "text-[var(--ink-primary)]"}`}>
                  {opt.label}
                </span>
                {opt.busy ? (
                  <span className={`block truncate text-xs ${sheet ? "text-[var(--ink-muted)]" : "text-[var(--ink-muted)]"}`}>
                    {busyLabel}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
