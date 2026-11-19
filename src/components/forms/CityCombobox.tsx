"use client";

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/Input";
import {
  SHEET_DROPDOWN_CLASS,
  SHEET_INPUT_CLASS,
  SHEET_OPTION_CLASS,
  DEFAULT_DROPDOWN_CLASS,
  DEFAULT_OPTION_CLASS,
} from "@/components/calendar/newRide/sheetFieldClasses";

const SEARCH_DEBOUNCE_MS = 120;

// "grouped" sits inside a parent field that already draws the border/ring
// (§5.1's one-bordered-field route row) — bare, no border/shadow of its own.
const GROUPED_INPUT_CLASS =
  "h-full min-w-0 flex-1 bg-transparent text-[14px] text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:outline-none";

export interface CityComboboxHandle {
  focus: () => void;
}

// City field for pickup/destination/stop rows — searches live via Nominatim
// (/api/cities/search) instead of filtering a fixed list, so any town or
// city anywhere in the world can be found, not just the handful of Serbian
// cities the old static list covered. Purely a suggestion dropdown: the
// input is a normal free-text field underneath, so typing a city that
// doesn't show up in the list (or picking none at all) still works — the
// backend has never required a match against any whitelist.
//
// Full combobox keyboard pattern: focus stays on the input the whole time
// (ArrowDown/Up move an aria-activedescendant highlight, Enter commits,
// Escape closes) rather than moving real DOM focus into the list — so Tab
// always leaves to the next field, never gets trapped by or skips past the
// suggestions.
export const CityCombobox = forwardRef<
  CityComboboxHandle,
  {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
    className?: string;
    // "sheet" renders the Nova vožnja v2 field look (§2); "grouped" is the
    // borderless variant for §5.1's merged city+location field. Same
    // fetch/debounce/matching logic in every case — only classNames differ.
    variant?: "default" | "sheet" | "grouped";
    placeholder?: string;
    "aria-label"?: string;
  }
>(function CityCombobox(
  { id, value, onChange, required, className = "", variant = "default", placeholder, "aria-label": ariaLabel },
  ref,
) {
  const t = useTranslations("common");
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [matches, setMatches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sheet = variant === "sheet";
  const grouped = variant === "grouped";

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMatches([]);
      setLoading(false);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveIndex(-1);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/cities/search?q=${encodeURIComponent(query)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled) return;
          setMatches(Array.isArray(data?.cities) ? data.cities.map((c: { display: string }) => c.display) : []);
          setActiveIndex(-1);
          setLoading(false);
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value]);

  function commit(index: number) {
    const city = matches[index];
    if (!city) return;
    onChange(city);
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((i) => Math.min(matches.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter") {
      if (open && activeIndex >= 0) {
        event.preventDefault();
        commit(activeIndex);
      }
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
    }
  }

  const input = (
    <Input
      id={id}
      ref={inputRef}
      unstyled={sheet || grouped}
      className={sheet ? SHEET_INPUT_CLASS : grouped ? GROUPED_INPUT_CLASS : undefined}
      required={required}
      value={value}
      placeholder={placeholder}
      autoComplete="off"
      aria-label={ariaLabel}
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={open}
      aria-controls={listboxId}
      aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
      onChange={(e) => {
        onChange(e.target.value);
        setOpen(true);
      }}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={onKeyDown}
    />
  );

  return (
    <div ref={containerRef} className={`relative ${grouped ? "flex min-w-0 flex-1 items-center" : ""} ${className}`}>
      {grouped ? (
        <>
          {input}
          <ChevronDown />
        </>
      ) : (
        input
      )}
      {open && (matches.length > 0 || loading) ? (
        <ul id={listboxId} role="listbox" className={sheet || grouped ? SHEET_DROPDOWN_CLASS : DEFAULT_DROPDOWN_CLASS}>
          {matches.map((city, index) => (
            <li key={city} id={`${listboxId}-option-${index}`} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                tabIndex={-1}
                className={`${sheet || grouped ? SHEET_OPTION_CLASS : DEFAULT_OPTION_CLASS} ${
                  index === activeIndex ? "bg-[var(--border-soft)]" : ""
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(index);
                }}
              >
                {city}
              </button>
            </li>
          ))}
          {loading && matches.length === 0 ? (
            <li className={`px-3 py-1.5 ${sheet || grouped ? "text-[var(--ink-muted)]" : "text-[var(--ink-muted)]"}`}>
              {t("loading")}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
});

function ChevronDown() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} className="ml-1 shrink-0 text-[var(--ink-muted)]" fill="none" aria-hidden="true">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
