"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { DEFAULT_OPTION_CLASS, SHEET_OPTION_CLASS } from "@/components/calendar/newRide/sheetFieldClasses";

const SEARCH_DEBOUNCE_MS = 250;

// Once the server reports Google isn't configured (or the visitor isn't
// signed in), stop asking for the rest of the page's life — every location
// field then behaves as the plain text input it always was.
let placesAvailable = true;

interface Suggestion {
  placeId: string;
  main: string;
  secondary: string;
}

function newSessionToken(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// The "exact location" (hotel, stop, address) field with Google Places
// suggestions, biased to the ride's city: typing "sava" offers "Sava
// Centar — Milentija Popovića, Beograd", and picking it fills in "Sava
// Centar, Milentija Popovića 9, Novi Beograd". Picking only sets this
// field's text; the city field is never touched, so nothing here depends
// on how a parent form batches its state updates.
//
// Still a free-text field underneath: typing without picking works exactly
// as before. Same combobox keyboard pattern as CityCombobox (focus stays on
// the input; arrows move an aria-activedescendant highlight).
export function PlaceLocationInput({
  id,
  value,
  onChange,
  city,
  placeholder,
  required,
  variant = "default",
  className = "",
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** The ride's chosen city for this stop — suggestions are biased to it. */
  city: string;
  placeholder?: string;
  required?: boolean;
  /** "grouped" is the borderless input inside the new-ride sheet's merged city+location field. */
  variant?: "default" | "grouped";
  className?: string;
  "aria-label"?: string;
}) {
  const t = useTranslations("places");
  const locale = useLocale();
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Only search after the user has typed here — never for a value that was
  // prefilled (editing an existing ride) or just filled in by a pick.
  const [query, setQuery] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  const grouped = variant === "grouped";

  useEffect(() => {
    const q = query?.trim() ?? "";
    if (!placesAvailable || q.length < 3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      sessionRef.current ??= newSessionToken();
      const params = new URLSearchParams({ q, session: sessionRef.current, lang: locale, city });
      const res = await fetch(`/api/places/autocomplete?${params}`).catch(() => null);
      if (cancelled) return;
      if (res?.status === 401) placesAvailable = false;
      const data = res?.ok ? await res.json().catch(() => null) : null;
      if (cancelled) return;
      if (data?.enabled === false) placesAvailable = false;
      setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
      setActiveIndex(-1);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, city, locale]);

  async function pick(index: number) {
    const suggestion = suggestions[index];
    if (!suggestion) return;
    setOpen(false);
    setSuggestions([]);
    setQuery(null);

    // Show the name straight away; the details call only refines it with
    // the street number and borough.
    const fallback = suggestion.main;
    onChange(fallback);

    const session = sessionRef.current ?? newSessionToken();
    sessionRef.current = null; // a pick ends the billing session
    const params = new URLSearchParams({
      placeId: suggestion.placeId,
      main: suggestion.main,
      secondary: suggestion.secondary,
      session,
      lang: locale,
      city,
    });
    const res = await fetch(`/api/places/details?${params}`).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    if (typeof data?.location === "string" && data.location) onChange(data.location);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const visible = open && suggestions.length > 0;
    if (event.key === "ArrowDown" && suggestions.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(suggestions.length - 1, i + 1));
    } else if (event.key === "ArrowUp" && visible) {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter" && visible && activeIndex >= 0) {
      event.preventDefault();
      void pick(activeIndex);
    } else if (event.key === "Escape" && visible) {
      event.preventDefault();
      setOpen(false);
    }
  }

  const showList = open && suggestions.length > 0;

  return (
    <div className={`relative ${grouped ? "flex h-full min-w-0 flex-1 items-center" : ""} ${className}`}>
      <Input
        id={id}
        unstyled={grouped}
        className={
          grouped
            ? "h-full min-w-0 flex-1 truncate bg-transparent text-[14px] text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:outline-none"
            : undefined
        }
        required={required}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-activedescendant={showList && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        onChange={(e) => {
          onChange(e.target.value);
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {showList ? (
        <div
          className={
            grouped
              ? "absolute right-0 top-[calc(100%+6px)] z-20 w-[min(420px,calc(100vw-48px))] overflow-hidden rounded-[10px] bg-white text-[14px] shadow-[0_1px_2px_rgba(24,24,27,.04),0_8px_24px_rgba(24,24,27,.10)] ring-1 ring-[var(--border-soft)]"
              : "absolute left-0 top-full z-20 mt-1 w-full min-w-[280px] overflow-hidden rounded-md border border-zinc-200 bg-white text-sm shadow-lg"
          }
        >
          <ul id={listboxId} role="listbox" className="max-h-64 overflow-auto py-1">
            {suggestions.map((s, index) => (
              <li key={s.placeId} id={`${listboxId}-option-${index}`} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  tabIndex={-1}
                  className={`${grouped ? SHEET_OPTION_CLASS : DEFAULT_OPTION_CLASS} flex items-start gap-2.5 ${
                    index === activeIndex ? (grouped ? "bg-[var(--border-soft)]" : "bg-zinc-100") : ""
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void pick(index);
                  }}
                >
                  <MapPin size={15} strokeWidth={1.9} className="mt-[2px] shrink-0 text-[var(--ink-muted)]" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-[var(--ink-primary)]">{s.main}</span>
                    {s.secondary ? (
                      <span className="block truncate text-[12.5px] text-[var(--ink-muted)]">{s.secondary}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {/* Attribution Google requires wherever its place suggestions appear without a Google map. */}
          <p className="m-0 border-t border-[var(--border-soft)] px-3 py-1.5 text-right text-[11px] text-[var(--ink-muted)]">
            {t("poweredByGoogle")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
