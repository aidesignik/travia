import type { Coordinates } from "./distance";
import { resolveCityDisplay } from "./citySearch";

// Google Maps Platform: Places (New) autocomplete + details for the
// "exact location" search field, and Routes for road distance. All calls
// are server-side so the key never reaches the browser. Everything here is
// optional — with no GOOGLE_MAPS_API_KEY set (or when Google errors, or a
// daily quota cap in Google Cloud is hit) callers fall back to the free
// Nominatim/OSRM path in tripDistance.ts and a plain text field in the UI.
//
// Billing notes (see the PR / README for the quota caps to set):
// - Autocomplete keystrokes are grouped into a session by `sessionToken`;
//   a session that ends in a Place Details call is billed as that one
//   Details request, so the keystrokes themselves cost nothing.
// - Place Details asks only for Essentials-tier fields (formattedAddress,
//   addressComponents) — displayName would bump it to the Pro tier, so the
//   place's name comes from the autocomplete suggestion instead.
// - computeRoutes asks only for routes.distanceMeters (Essentials).
// - Google's terms don't allow storing Places coordinates long-term, so no
//   coordinates are requested or kept: places are stored as text, and the
//   route distance is calculated by Google from those addresses.

const PLACES_URL = "https://places.googleapis.com/v1";
const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const TIMEOUT_MS = 6000;

function apiKey(): string | null {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  return key ? key : null;
}

export function googleMapsEnabled(): boolean {
  return apiKey() !== null;
}

export type PlacesLanguage = "en" | "sr";

// Serbian UI gets Latin-script results ("Beograd", not "Београд"), matching
// the rest of the app.
function languageCode(language: PlacesLanguage): string {
  return language === "sr" ? "sr-Latn" : "en";
}

async function googleFetch(url: string, init: RequestInit & { fieldMask: string }): Promise<Response | null> {
  const key = apiKey();
  if (!key) return null;
  const { fieldMask, headers, ...rest } = init;
  try {
    return await fetch(url, {
      ...rest,
      headers: {
        ...headers,
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": fieldMask,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    console.warn(`[googleMaps] request to ${new URL(url).pathname} failed:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Places autocomplete
// ---------------------------------------------------------------------------

export interface PlaceSuggestion {
  placeId: string;
  /** The place's own name, e.g. "Sava Centar". */
  main: string;
  /** The rest of its address, e.g. "Milentija Popovića, Beograd, Srbija". */
  secondary: string;
}

/** Suggestions biased to ~30 km around `near` when given (the ride's chosen city). */
export async function autocompletePlaces(params: {
  input: string;
  sessionToken: string;
  language: PlacesLanguage;
  near?: Coordinates | null;
}): Promise<PlaceSuggestion[] | null> {
  const body: Record<string, unknown> = {
    input: params.input,
    sessionToken: params.sessionToken,
    languageCode: languageCode(params.language),
    regionCode: "rs",
  };
  if (params.near) {
    body.locationBias = {
      circle: { center: { latitude: params.near.lat, longitude: params.near.lng }, radius: 30000 },
    };
  }

  const res = await googleFetch(`${PLACES_URL}/places:autocomplete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    fieldMask: "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat",
  });
  if (!res) return null;
  if (!res.ok) {
    console.warn(`[googleMaps] autocomplete returned ${res.status}: ${await res.text().catch(() => "")}`);
    return null;
  }

  const data = (await res.json().catch(() => null)) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId?: string;
        structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
      };
    }>;
  } | null;

  return (data?.suggestions ?? []).flatMap((s) => {
    const p = s.placePrediction;
    const main = p?.structuredFormat?.mainText?.text?.trim();
    if (!p?.placeId || !main) return [];
    return [{ placeId: p.placeId, main, secondary: p.structuredFormat?.secondaryText?.text?.trim() ?? "" }];
  });
}

// ---------------------------------------------------------------------------
// Place details → the text stored in the "exact location" field
// ---------------------------------------------------------------------------

export interface PlaceAddressParts {
  street: string | null;
  sublocality: string | null;
  locality: string | null;
  /** administrative_area_level_2 — the town stand-in for places outside any locality. */
  area?: string | null;
  country: string | null;
  /** ISO country code, e.g. "RS". */
  countryCode?: string | null;
  /** The place's own types, e.g. ["locality", "political"] for a city. */
  types?: string[];
}

export async function placeAddressParts(params: {
  placeId: string;
  sessionToken: string;
  language: PlacesLanguage;
}): Promise<PlaceAddressParts | null> {
  const query = new URLSearchParams({
    sessionToken: params.sessionToken,
    languageCode: languageCode(params.language),
    regionCode: "rs",
  });
  const res = await googleFetch(`${PLACES_URL}/places/${encodeURIComponent(params.placeId)}?${query}`, {
    method: "GET",
    fieldMask: "addressComponents,types",
  });
  if (!res) return null;
  if (!res.ok) {
    console.warn(`[googleMaps] place details returned ${res.status}: ${await res.text().catch(() => "")}`);
    return null;
  }

  const data = (await res.json().catch(() => null)) as {
    addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }>;
    types?: string[];
  } | null;
  const components = data?.addressComponents ?? [];
  const component = (...types: string[]) => components.find((c) => types.some((type) => c.types?.includes(type)));
  const find = (...types: string[]) => component(...types)?.longText?.trim() || null;

  const route = find("route");
  const number = find("street_number");
  return {
    street: route ? (number ? `${route} ${number}` : route) : null,
    sublocality: find("sublocality_level_1", "sublocality"),
    locality: find("locality", "postal_town"),
    area: find("administrative_area_level_2"),
    country: find("country"),
    countryCode: component("country")?.shortText?.trim() || null,
    types: data?.types ?? [],
  };
}

// A suggestion that IS a town/region/country (picking "Novi Sad" itself)
// sets just the ride's city — there's no exact spot inside it.
const AREA_TYPES = new Set([
  "locality",
  "postal_town",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "administrative_area_level_3",
  "country",
]);

/**
 * City + exact location for a suggestion picked in the single route field
 * (RoutePlaceField): the city comes from Google's own address data, mapped
 * onto the city list's spelling (resolveCityDisplay), and the location is
 * the name/street/borough relative to it. Without details, both are read
 * from the suggestion's secondary text ("Milentija Popovića, Beograd,
 * Srbija" → city "Beograd").
 */
export function resolvePlaceSelection(
  suggestion: { main: string; secondary: string },
  parts: PlaceAddressParts | null,
): { city: string; location: string } {
  if (parts) {
    const town = parts.locality ?? parts.area;
    const isArea = (parts.types ?? []).some((type) => AREA_TYPES.has(type));
    if (isArea) {
      return { city: resolveCityDisplay(town ?? suggestion.main, parts.countryCode ?? null), location: "" };
    }
    const city = town ? resolveCityDisplay(town, parts.countryCode ?? null) : "";
    return { city, location: composePlaceLocation(suggestion, parts, city) };
  }

  const segments = suggestion.secondary
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) {
    // Nothing but a name (typically a country or region) — treat it as the city.
    return { city: resolveCityDisplay(suggestion.main, null), location: "" };
  }
  // Secondary text ends with the country; the segment before it is the town.
  const city = segments.length >= 2 ? resolveCityDisplay(segments[segments.length - 2], null) : "";
  return { city, location: composePlaceLocation(suggestion, null, city) };
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();
}

// English exonyms Google returns for Serbian places the app stores under
// their local name — so "Belgrade" from Google matches a ride city "Beograd".
const EXONYMS: Record<string, string> = { belgrade: "beograd" };

function sameCity(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  return (EXONYMS[na] ?? na) === (EXONYMS[nb] ?? nb);
}

/**
 * The "exact location" text for a picked suggestion: its name, then the
 * street and borough (e.g. "Sava Centar, Milentija Popovića 9, Novi
 * Beograd"), plus the town only when it differs from the ride's city (the
 * city is appended separately everywhere the location is shown or routed).
 * Falls back to the suggestion's own secondary text, minus the country,
 * when details aren't available.
 */
export function composePlaceLocation(
  suggestion: { main: string; secondary: string },
  parts: PlaceAddressParts | null,
  city: string,
): string {
  const pieces: string[] = [suggestion.main];
  const add = (value: string | null) => {
    if (!value) return;
    const lower = normalizeName(value);
    if (pieces.some((piece) => normalizeName(piece).includes(lower))) return;
    pieces.push(value);
  };

  if (parts) {
    add(parts.street);
    add(parts.sublocality);
    if (parts.locality && (!city || !sameCity(parts.locality, city))) add(parts.locality);
    return pieces.join(", ");
  }

  const rest = suggestion.secondary
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // Last segment of Google's secondary text is the country.
  if (rest.length > 1) rest.pop();
  for (const segment of rest) {
    if (city && sameCity(segment, city)) continue;
    add(segment);
  }
  return pieces.join(", ");
}

// ---------------------------------------------------------------------------
// Routes: road distance between addresses
// ---------------------------------------------------------------------------

const routeCache = new Map<string, number>();
const ROUTE_CACHE_LIMIT = 500;

/**
 * Driving distance in km through the given addresses, in order (Google
 * geocodes them itself). Null when the key isn't set, Google can't place
 * one of the addresses, or the request fails — callers fall back to the
 * free estimate. Cached in-process by address list, since the live preview
 * re-asks for the same route as other fields change.
 */
export async function googleRouteDistanceKm(addresses: string[]): Promise<number | null> {
  if (addresses.length < 2 || !googleMapsEnabled()) return null;
  const cacheKey = addresses.map((a) => a.trim().toLowerCase()).join(" | ");
  const cached = routeCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const [origin, ...rest] = addresses;
  const destination = rest.pop()!;
  const res = await googleFetch(ROUTES_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: { address: origin },
      destination: { address: destination },
      intermediates: rest.map((address) => ({ address })),
      travelMode: "DRIVE",
      regionCode: "rs",
      units: "METRIC",
    }),
    fieldMask: "routes.distanceMeters",
  });
  if (!res) return null;
  if (!res.ok) {
    console.warn(`[googleMaps] computeRoutes returned ${res.status}: ${await res.text().catch(() => "")}`);
    return null;
  }

  const data = (await res.json().catch(() => null)) as { routes?: Array<{ distanceMeters?: number }> } | null;
  const meters = data?.routes?.[0]?.distanceMeters;
  if (typeof meters !== "number" || !Number.isFinite(meters)) return null;

  const km = meters / 1000;
  if (routeCache.size >= ROUTE_CACHE_LIMIT) {
    const oldest = routeCache.keys().next().value;
    if (oldest !== undefined) routeCache.delete(oldest);
  }
  routeCache.set(cacheKey, km);
  return km;
}
