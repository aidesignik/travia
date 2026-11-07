import cities from "cities.json";
import { EUROPEAN_COUNTRY_CODES as EUROPEAN_COUNTRY_CODE_LIST } from "./europeanCountryCodes";
import type { Coordinates } from "./distance";

export interface CitySuggestion {
  /** What to show in the dropdown and store as the city value if picked. */
  display: string;
}

interface RawCity {
  name: string;
  lat: string;
  lng: string;
  country: string;
  admin1: string;
  admin2: string;
}

// A few GeoNames records carry an English exonym as their primary name
// instead of the local Latin-script spelling — e.g. Belgrade's record is
// literally named "Belgrade", not "Beograd". Patched here rather than
// touching the dataset.
const NAME_OVERRIDES: Record<string, string> = {
  "RS:Belgrade": "Beograd",
};

// cities.json has no population figures to rank by, so a query like "be"
// or "nov" would otherwise surface minor villages ahead of Beograd or
// Novi Sad on pure alphabetical order (e.g. "Bečej" < "Beograd"). This
// gives Serbia's major cities, largest first, a fixed head-of-queue spot
// among same-tier RS matches — everything else still falls back to
// alphabetical.
const MAJOR_RS_CITIES = [
  "Beograd",
  "Novi Sad",
  "Niš",
  "Kragujevac",
  "Subotica",
  "Zrenjanin",
  "Pančevo",
  "Čačak",
  "Kruševac",
  "Kraljevo",
  "Novi Pazar",
  "Smederevo",
  "Leskovac",
  "Valjevo",
  "Vranje",
  "Šabac",
  "Sombor",
  "Užice",
  "Požarevac",
  "Pirot",
];
const majorRsRank = new Map(MAJOR_RS_CITIES.map((name, i) => [name, i]));

// This carrier's trips are domestic or cross-border within Europe — not
// overseas — so the suggestion dropdown is scoped to European countries
// only, rather than surfacing an identically-named town in the US or Asia
// ahead of (or instead of) the European one a user actually means. Shared
// with geocoding.ts, which scopes live Nominatim lookups to the same set.
const EUROPEAN_COUNTRY_CODES = new Set<string>(EUROPEAN_COUNTRY_CODE_LIST);

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

function stripDiacritics(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function searchKey(value: string): string {
  return stripDiacritics(value).toLowerCase();
}

interface IndexedCity {
  name: string;
  country: string;
  key: string;
  lat: number;
  lng: number;
}

// Built once per server process from the bundled ~171k-city dataset
// (filtered to Europe, see EUROPEAN_COUNTRY_CODES), keyed by a
// diacritic-stripped lowercase form so a query like "cacak" (easier to
// type without a Serbian keyboard layout) still finds "Čačak".
let index: IndexedCity[] | null = null;

function getIndex(): IndexedCity[] {
  if (!index) {
    index = (cities as RawCity[])
      .filter((c) => EUROPEAN_COUNTRY_CODES.has(c.country))
      .map((c) => {
        const name = NAME_OVERRIDES[`${c.country}:${c.name}`] ?? c.name;
        return { name, country: c.country, key: searchKey(name), lat: Number(c.lat), lng: Number(c.lng) };
      });
  }
  return index;
}

function displayFor(city: IndexedCity): string {
  return city.country === "RS" ? city.name : `${city.name}, ${regionNames.of(city.country) ?? city.country}`;
}

// Reverse lookup from exactly the string this module hands back as a
// suggestion's `display` (and what CityCombobox then stores verbatim as
// the ride's city) to that city's own coordinate — built once, alongside
// the search index, over the same filtered/deduplicated dataset.
let coordinateIndex: Map<string, Coordinates> | null = null;

function getCoordinateIndex(): Map<string, Coordinates> {
  if (!coordinateIndex) {
    coordinateIndex = new Map();
    for (const city of getIndex()) {
      coordinateIndex.set(displayFor(city), { lat: city.lat, lng: city.lng });
    }
  }
  return coordinateIndex;
}

/**
 * Exact coordinate for a city exactly as stored on a ride (the same
 * `display` string CityCombobox writes when a suggestion is picked) —
 * authoritative, no network call, no ambiguity, since it's a direct lookup
 * into the very dataset the dropdown offered it from. Distance calculation
 * (tripDistance.ts) prefers this over re-geocoding the bare city name
 * live: several Serbian town names (e.g. "Bor", "Sopot", "Rudnik") also
 * name places in other European countries this app's geocoding scope
 * includes, and a bare, location-less free-text query for one of those
 * names has no context to disambiguate — Nominatim can and does return
 * the wrong country's match, which previously had no cross-check at all.
 * Returns null for a city not in the bundled dataset (free-typed, or a
 * settlement too small to be included) — callers fall back to live
 * geocoding in that case.
 */
export function findCityCoordinates(display: string): Coordinates | null {
  return getCoordinateIndex().get(display.trim()) ?? null;
}

const MAX_RESULTS = 8;

/**
 * Instant, local city/town search backing the city-field suggestion
 * dropdown. Replaces a live Nominatim lookup — too slow for a
 * keystroke-driven dropdown (network round-trip plus Nominatim's ~1
 * req/sec rate limit), and prone to returning Cyrillic names for Serbian
 * places since that's Serbia's official script in OSM data — with an
 * in-memory scan over a bundled dataset scoped to Europe (this carrier's
 * actual trips never leave the continent) and confirmed to use Latin
 * spellings for Serbian settlements. Domestic (Serbian) results are shown
 * bare ("Beograd"); others get the country appended ("Paris, France") for
 * disambiguation.
 */
export function searchCities(query: string): CitySuggestion[] {
  const q = searchKey(query.trim());
  if (q.length < 2) return [];

  const exact: IndexedCity[] = [];
  const starts: IndexedCity[] = [];
  const contains: IndexedCity[] = [];
  for (const city of getIndex()) {
    if (city.key === q) exact.push(city);
    else if (city.key.startsWith(q)) starts.push(city);
    else if (city.key.includes(q)) contains.push(city);
  }
  // No population data to rank by, so for a short query that matches
  // places worldwide (e.g. "be"), favor this app's mostly-Serbian user
  // base over plain alphabetical order — otherwise an unrelated village
  // that happens to sort earlier can bump Beograd off an 8-result list.
  const byRelevance = (a: IndexedCity, b: IndexedCity) => {
    if (a.country === "RS" && b.country !== "RS") return -1;
    if (a.country !== "RS" && b.country === "RS") return 1;
    const rankA = majorRsRank.get(a.name) ?? Infinity;
    const rankB = majorRsRank.get(b.name) ?? Infinity;
    if (rankA !== rankB) return rankA - rankB;
    return a.name.localeCompare(b.name);
  };
  starts.sort(byRelevance);
  contains.sort(byRelevance);

  const seen = new Set<string>();
  const suggestions: CitySuggestion[] = [];
  for (const city of [...exact, ...starts, ...contains]) {
    const display = displayFor(city);
    if (seen.has(display)) continue;
    seen.add(display);
    suggestions.push({ display });
    if (suggestions.length >= MAX_RESULTS) break;
  }
  return suggestions;
}

// English exonyms Google (or a user) may give for Serbian cities the
// dataset stores under their local name.
const CITY_EXONYMS: Record<string, string> = { belgrade: "beograd" };

/**
 * The city string to store for a place Google located in `name` (its
 * town) — the dataset's own `display` when there's a match, so a city
 * picked through Google is stored exactly like one picked from the city
 * list ("Beograd", "Paris, France") and keeps working with
 * findCityCoordinates, the calendar and filters. Falls back to the name
 * itself (with the country appended outside Serbia) for places too small
 * to be in the dataset.
 */
export function resolveCityDisplay(name: string, countryCode: string | null): string {
  const trimmed = name.trim();
  const rawKey = searchKey(trimmed);
  const key = CITY_EXONYMS[rawKey] ?? rawKey;
  const code = countryCode ? countryCode.toUpperCase() : null;

  const matches = getIndex().filter((c) => c.key === key && (!code || c.country === code));
  if (matches.length > 0) {
    matches.sort((a, b) => (a.country === "RS" ? -1 : b.country === "RS" ? 1 : 0));
    return displayFor(matches[0]);
  }
  if (!code || code === "RS") return trimmed;
  return `${trimmed}, ${regionNames.of(code) ?? code}`;
}
