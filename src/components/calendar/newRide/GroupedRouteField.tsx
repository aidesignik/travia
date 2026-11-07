"use client";

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Building2, MapPin, PencilLine, X } from "lucide-react";
import type { CityLocation } from "@/lib/location";
import { SHEET_OPTION_CLASS } from "./sheetFieldClasses";

const CITY_DEBOUNCE_MS = 120;
const PLACES_DEBOUNCE_MS = 250;

// Once the server says Google isn't available (no key, or not signed in),
// stop asking for the rest of the page's life — the field then offers the
// bundled city list plus "use what I typed", exactly what the old
// city-select + address pair could do.
let placesAvailable = true;

export interface RouteFieldHandle {
  focus: () => void;
}

interface PlaceOption {
  kind: "place";
  placeId: string;
  main: string;
  secondary: string;
}
interface CityOption {
  kind: "city";
  display: string;
}
interface TypedOption {
  kind: "typed";
  text: string;
}
type Option = PlaceOption | CityOption | TypedOption;

function newSessionToken(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function labelFor({ city, location }: CityLocation): string {
  if (location && city) return `${location}, ${city}`;
  return location || city;
}

// §5.1 "like Google Maps directions": one field per stop — "Where from?",
// "Stop", "Where to?". Typing searches Google Places (biased to Serbia)
// and the bundled city list together:
//   - picking a place ("Sava Centar") sets the city AND the exact location
//     in one change ({ city: "Beograd", location: "Sava Centar, Milentija
//     Popovića 9, Novi Beograd" }), the city taken from Google's address
//     data and spelled the way the city list spells it;
//   - picking a city ("Novi Sad") sets just the city — a city-to-city ride;
//   - "Use …" keeps what was typed as the exact location in the city
//     already chosen, for a spot Google doesn't know.
// Still stores the same two values as before, so the calendar, documents,
// distance and every API are unchanged. While not focused the field shows
// "location, city"; leaving it without picking restores that (or clears
// the stop if the text was deleted).
//
// Same combobox keyboard pattern as CityCombobox: focus stays on the
// input, arrows move an aria-activedescendant highlight, Enter picks.
export const GroupedRouteField = forwardRef<
  RouteFieldHandle,
  {
    value: CityLocation;
    onChange: (value: CityLocation) => void;
    placeholder: string;
    /**
     * Pickup/destination need an exact address (it goes on the run sheet and
     * documents): picking just a city keeps the field open, asking for the
     * address in that city, with Google suggestions biased to it.
     */
    requireLocation?: boolean;
    removable?: boolean;
    onRemove?: () => void;
    removeLabel?: string;
    error?: boolean;
  }
>(function GroupedRouteField(
  { value, onChange, placeholder, requireLocation, removable, onRemove, removeLabel, error },
  ref,
) {
  const t = useTranslations("places");
  const locale = useLocale();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<string | null>(null);
  // The latest onChange, for calls made after an await — a parent whose
  // handler closes over its own state must get the current render's one.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  // Whether the user has typed since focusing — only then does leaving an
  // empty field clear the stop (not after a city pick that emptied it).
  const [typed, setTyped] = useState(false);
  // Set right after picking a city for a field that needs an address:
  // the input stays focused and empty, prompting for the address.
  const [askingAddressIn, setAskingAddressIn] = useState<string | null>(null);
  const [places, setPlaces] = useState<PlaceOption[]>([]);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [resolving, setResolving] = useState(false);

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }));

  const committedLabel = labelFor(value);
  const query = editing && typed && text !== committedLabel ? text.trim() : "";

  // Bundled city list — instant and free, always available.
  useEffect(() => {
    if (query.length < 2) {
      setCities([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/cities/search?q=${encodeURIComponent(query)}`).catch(() => null);
      const data = res?.ok ? await res.json().catch(() => null) : null;
      if (cancelled) return;
      const list: Array<{ display: string }> = Array.isArray(data?.cities) ? data.cities : [];
      setCities(list.slice(0, 4).map((c) => ({ kind: "city", display: c.display })));
    }, CITY_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  // Google Places — grouped into one billing session per pick.
  useEffect(() => {
    if (!placesAvailable || query.length < 3) {
      setPlaces([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      sessionRef.current ??= newSessionToken();
      const params = new URLSearchParams({ q: query, session: sessionRef.current, lang: locale, city: value.city });
      const res = await fetch(`/api/places/autocomplete?${params}`).catch(() => null);
      if (cancelled) return;
      if (res?.status === 401) placesAvailable = false;
      const data = res?.ok ? await res.json().catch(() => null) : null;
      if (cancelled) return;
      if (data?.enabled === false) placesAvailable = false;
      const list: Array<{ placeId: string; main: string; secondary: string }> = Array.isArray(data?.suggestions)
        ? data.suggestions
        : [];
      setPlaces(list.slice(0, 5).map((s) => ({ kind: "place", ...s })));
    }, PLACES_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, locale, value.city]);

  const options: Option[] = [];
  if (query) {
    options.push(...places);
    const placeNames = new Set(places.map((p) => p.main.toLowerCase()));
    options.push(...cities.filter((c) => !placeNames.has(c.display.toLowerCase())));
    options.push({ kind: "typed", text: query });
  }

  function finishEditing() {
    setEditing(false);
    setTyped(false);
    setAskingAddressIn(null);
    setPlaces([]);
    setCities([]);
    setActiveIndex(-1);
  }

  async function pick(option: Option) {
    if (option.kind === "city" && requireLocation) {
      // Keep going: same field, now asking for the address in this city.
      onChange({ city: option.display, location: "" });
      setText("");
      setTyped(false);
      setAskingAddressIn(option.display);
      setPlaces([]);
      setCities([]);
      setActiveIndex(-1);
      return;
    }
    finishEditing();
    if (option.kind === "city") {
      onChange({ city: option.display, location: "" });
      return;
    }
    if (option.kind === "typed") {
      // With a city already chosen, the text is an exact spot in it;
      // otherwise it becomes the city itself (a town not in the list).
      onChange(value.city ? { city: value.city, location: option.text } : { city: option.text, location: "" });
      return;
    }

    // Google place: the details call works out the city and the exact
    // address, and closes the billing session.
    const session = sessionRef.current ?? newSessionToken();
    sessionRef.current = null;
    setText(option.main);
    setResolving(true);
    const params = new URLSearchParams({
      placeId: option.placeId,
      main: option.main,
      secondary: option.secondary,
      session,
      lang: locale,
      derive: "1",
    });
    const res = await fetch(`/api/places/details?${params}`).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    setResolving(false);
    if (data && typeof data.city === "string" && typeof data.location === "string") {
      onChangeRef.current({ city: data.city || value.city, location: data.location });
    } else {
      onChangeRef.current({ city: value.city, location: option.main });
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && options.length > 0) {
      event.preventDefault();
      setActiveIndex((i) => Math.min(options.length - 1, i + 1));
    } else if (event.key === "ArrowUp" && options.length > 0) {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter" && activeIndex >= 0 && options[activeIndex]) {
      event.preventDefault();
      void pick(options[activeIndex]);
    } else if (event.key === "Escape" && options.length > 0) {
      // Close just the suggestions, not the whole sheet.
      event.preventDefault();
      event.stopPropagation();
      setText(committedLabel);
      finishEditing();
    }
  }

  const showList = editing && options.length > 0;

  return (
    <div className="relative min-w-0 flex-1">
      <div
        className={`flex h-10 min-w-0 items-center rounded-[8px] border pl-3 transition-shadow duration-[.12s] ease-out focus-within:border-[var(--action-bg)] focus-within:shadow-[0_0_0_3px_var(--action-100)] ${
          error ? "border-[var(--ink-destructive-ring)]" : "border-[var(--border-control)]"
        }`}
        style={{ paddingRight: removable ? 0 : 12 }}
      >
        <input
          ref={inputRef}
          value={editing || resolving ? text : committedLabel}
          placeholder={askingAddressIn ? t("addressIn", { city: askingAddressIn }) : placeholder}
          aria-label={placeholder}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-activedescendant={showList && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
          onFocus={(e) => {
            setText(committedLabel);
            setEditing(true);
            e.currentTarget.select();
          }}
          onChange={(e) => {
            setText(e.target.value);
            setTyped(true);
            setActiveIndex(-1);
          }}
          onBlur={() => {
            // Deleting the text and leaving clears the stop; anything else
            // that wasn't picked from the list reverts to the saved value.
            if (editing && typed && text.trim() === "" && committedLabel) onChange({ city: "", location: "" });
            finishEditing();
          }}
          onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 truncate bg-transparent text-[14px] text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:outline-none"
        />
        {resolving ? (
          <span className="mr-1 h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[var(--border-soft)] border-t-[var(--ink-muted)]" />
        ) : null}
        {removable ? (
          <button
            type="button"
            onClick={onRemove}
            title={removeLabel}
            aria-label={removeLabel}
            onMouseDown={(e) => e.preventDefault()}
            className="mr-[6px] flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-[var(--ink-muted)] transition-colors duration-[.12s] ease-out hover:bg-[var(--border-soft)] hover:text-[var(--ink-secondary)]"
          >
            <X size={14} strokeWidth={1.9} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {showList ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-[10px] bg-white text-[14px] shadow-[0_1px_2px_rgba(24,24,27,.04),0_8px_24px_rgba(24,24,27,.10)] ring-1 ring-[var(--border-soft)]">
          <ul id={listboxId} role="listbox" className="max-h-72 overflow-auto py-1">
            {options.map((option, index) => {
              const Icon = option.kind === "place" ? MapPin : option.kind === "city" ? Building2 : PencilLine;
              const title =
                option.kind === "place"
                  ? option.main
                  : option.kind === "city"
                    ? option.display
                    : t("useTyped", { text: option.text });
              const subtitle =
                option.kind === "place"
                  ? option.secondary
                  : option.kind === "typed"
                    ? value.city || t("asCity")
                    : t("wholeCity");
              return (
                <li
                  key={option.kind === "place" ? option.placeId : `${option.kind}:${title}`}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    className={`${SHEET_OPTION_CLASS} flex items-start gap-2.5 ${
                      index === activeIndex ? "bg-[var(--border-soft)]" : ""
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      void pick(option);
                    }}
                  >
                    <Icon size={15} strokeWidth={1.9} className="mt-[2px] shrink-0 text-[var(--ink-muted)]" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-[var(--ink-primary)]">{title}</span>
                      {subtitle ? (
                        <span className="block truncate text-[12.5px] text-[var(--ink-muted)]">{subtitle}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {places.length > 0 ? (
            // Attribution Google requires wherever its suggestions appear without a Google map.
            <p className="m-0 border-t border-[var(--border-soft)] px-3 py-1.5 text-right text-[11px] text-[var(--ink-muted)]">
              {t("poweredByGoogle")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
