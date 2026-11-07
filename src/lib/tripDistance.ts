import { geocodeAddress } from "./geocoding";
import { osrmRouteDistanceKm, haversineRouteDistanceKm, haversineKm, type Coordinates } from "./distance";
import { formatLocation, type CityLocation } from "./location";
import { resolveReturnLeg } from "./rideReturnLeg";
import { findCityCoordinates } from "./citySearch";
import { googleRouteDistanceKm } from "./googleMaps";

// A generic/ambiguous location name (e.g. "Hotel") can geocode to an
// unrelated place of the same name elsewhere in the (Nominatim-scoped)
// region rather than the hotel actually in this city — if the "specific"
// result lands implausibly far from the city itself, that's a stronger
// signal of a bad match than a routing estimate, so fall back to the
// city-level coordinate instead of trusting a wildly wrong "precise" one.
const MAX_LOCATION_DRIFT_KM = 60;

export interface RouteEstimate {
  distanceKm: number;
  provider: "google" | "osrm" | "stub-haversine";
  /**
   * Geocoded coordinates in the same order as the input waypoints, for
   * callers that want to cache them. Empty for Google routes: Google's terms
   * don't allow keeping its coordinates, and none are requested.
   */
  coordinates: Coordinates[];
  /**
   * True when at least one waypoint's exact location couldn't be found and
   * its city centre was used instead — the figure is then only a rough
   * estimate (badly so for a ride inside one city), and the UI says so.
   */
  approximate: boolean;
}

/**
 * The city coordinate: looked up in the same bundled, Europe-scoped
 * dataset CityCombobox's suggestions come from (exact match on the same
 * `display` string that gets stored), falling back to a live Nominatim
 * geocode only for a city that isn't in that dataset (free-typed, or a
 * settlement too small to be included).
 *
 * This matters because a BARE city name alone is often ambiguous across
 * Nominatim's full index even scoped to Europe — several Serbian town
 * names (e.g. "Bor", "Sopot", "Rudnik", "Belgrade" the English exonym)
 * also name places in other European countries this app's scope
 * includes, and a location-less free-text query has no context at all to
 * disambiguate, unlike geocodeWaypoint's own location-vs-city drift check
 * below (which needs a correct city coordinate to compare against in the
 * first place — a live geocode wrong in the same way as the "specific"
 * query would pass that check without ever being caught).
 */
async function geocodeCity(city: string): Promise<Coordinates | null> {
  return findCityCoordinates(city) ?? geocodeAddress(city);
}

/**
 * Nominatim indexes places/addresses, not arbitrary business names — a
 * specific hotel or stop name often won't resolve on its own. Try the full
 * "location, city" string first, then fall back to the city alone so a
 * price estimate still shows even when the exact spot can't be found.
 *
 * When a specific result IS found, it's cross-checked against the city's
 * own coordinate: a generic location name (e.g. "Hotel") can match an
 * unrelated place with the same name instead of failing outright, so a
 * "successful" geocode isn't on its own proof the match is correct.
 */
async function geocodeWaypoint(
  waypoint: CityLocation,
): Promise<{ coords: Coordinates; approximate: boolean } | null> {
  if (!waypoint.location) {
    const city = await geocodeCity(waypoint.city);
    return city ? { coords: city, approximate: false } : null;
  }

  const specific = await geocodeAddress(formatLocation(waypoint));
  const cityOnly = await geocodeCity(waypoint.city);
  if (!specific) return cityOnly ? { coords: cityOnly, approximate: true } : null;
  if (!cityOnly) return { coords: specific, approximate: false };

  const driftKm = haversineKm(specific, cityOnly);
  return driftKm > MAX_LOCATION_DRIFT_KM
    ? { coords: cityOnly, approximate: true }
    : { coords: specific, approximate: false };
}

/**
 * Road distance across an ordered list of waypoints (pickup, any stops,
 * destination — at least 2).
 *
 * With GOOGLE_MAPS_API_KEY set, Google Routes calculates it straight from
 * the waypoint addresses, which handles exact places inside a city (e.g.
 * Sava Centar → Aerodrom Nikola Tesla) that the free geocoder often can't
 * find. Otherwise, or if Google fails, each waypoint is geocoded via
 * Nominatim and routed via OSRM, falling back to a haversine-based estimate
 * if OSRM is unreachable. Returns null only if one of the waypoints can't
 * be geocoded at all (city included). Geocoding is sequential (not
 * parallel) to respect Nominatim's rate limit even with several stops.
 */
export async function estimateRouteDistance(
  waypoints: CityLocation[],
): Promise<RouteEstimate | null> {
  const googleKm = await googleRouteDistanceKm(waypoints.map(formatLocation)).catch(() => null);
  if (googleKm !== null) {
    return { distanceKm: googleKm, provider: "google", coordinates: [], approximate: false };
  }

  const coordinates: Coordinates[] = [];
  let approximate = false;
  for (const waypoint of waypoints) {
    const geocoded = await geocodeWaypoint(waypoint);
    if (!geocoded) {
      // The live distance preview fails silently in the UI by design (it's
      // a non-critical nicety) — log server-side so a geocoding failure is
      // at least visible to whoever's running the dev server.
      console.warn(`[tripDistance] couldn't geocode "${formatLocation(waypoint)}" (or "${waypoint.city}")`);
      return null;
    }
    coordinates.push(geocoded.coords);
    approximate ||= geocoded.approximate;
  }

  try {
    const result = await osrmRouteDistanceKm(coordinates);
    return { distanceKm: result.distanceKm, provider: "osrm", coordinates, approximate };
  } catch (err) {
    console.warn("[tripDistance] OSRM routing failed, falling back to haversine estimate:", err);
    const result = haversineRouteDistanceKm(coordinates);
    return { distanceKm: result.distanceKm, provider: "stub-haversine", coordinates, approximate };
  }
}

export interface TripDistanceInput {
  pickupCity: string;
  pickupLocation: string;
  destinationCity: string;
  destinationLocation: string;
  stops: CityLocation[];
  isRoundTrip: boolean;
  returnPickupCity?: string;
  returnPickupLocation?: string;
  returnStops: CityLocation[];
  returnDestinationCity?: string;
  returnDestinationLocation?: string;
}

export interface TripDistanceResult {
  totalKm: number;
  outboundKm: number;
  // null for a one-way trip — there's no return leg to report.
  returnKm: number | null;
  /** Some exact location couldn't be found, so a city centre stood in for it (see RouteEstimate). */
  approximate: boolean;
}

/**
 * Total trip distance for the live "how many km is this?" preview shared
 * by the carrier and client-facing distance endpoints — the outbound leg
 * alone for a one-way trip, outbound + return for a round trip. The return
 * leg is resolved the same way resolveReturnLeg() does for display/storage:
 * endpoints default to the outbound swapped, no stops assumed unless given.
 * Returns both legs individually (not just the summed total) so a caller
 * can show an outbound/return breakdown without computing anything itself —
 * this was always calculated internally, just not previously returned.
 * Returns null if any waypoint can't be geocoded.
 */
export async function estimateTripDistance(input: TripDistanceInput): Promise<TripDistanceResult | null> {
  const outboundWaypoints = [
    { city: input.pickupCity, location: input.pickupLocation },
    ...input.stops,
    { city: input.destinationCity, location: input.destinationLocation },
  ];
  const outboundEstimate = await estimateRouteDistance(outboundWaypoints).catch(() => null);
  if (!outboundEstimate) return null;
  if (!input.isRoundTrip) {
    return {
      totalKm: outboundEstimate.distanceKm,
      outboundKm: outboundEstimate.distanceKm,
      returnKm: null,
      approximate: outboundEstimate.approximate,
    };
  }

  const returnLeg = resolveReturnLeg(
    {
      pickupCity: input.pickupCity,
      pickupLocation: input.pickupLocation,
      destinationCity: input.destinationCity,
      destinationLocation: input.destinationLocation,
      stops: input.stops,
    },
    {
      returnPickupCity: input.returnPickupCity,
      returnPickupLocation: input.returnPickupLocation,
      returnStops: input.returnStops,
      returnDestinationCity: input.returnDestinationCity,
      returnDestinationLocation: input.returnDestinationLocation,
    },
  );
  const returnWaypoints = [
    { city: returnLeg.pickupCity, location: returnLeg.pickupLocation },
    ...returnLeg.stops,
    { city: returnLeg.destinationCity, location: returnLeg.destinationLocation },
  ];
  const returnEstimate = await estimateRouteDistance(returnWaypoints).catch(() => null);
  if (!returnEstimate) return null;

  return {
    totalKm: outboundEstimate.distanceKm + returnEstimate.distanceKm,
    outboundKm: outboundEstimate.distanceKm,
    returnKm: returnEstimate.distanceKm,
    approximate: outboundEstimate.approximate || returnEstimate.approximate,
  };
}
