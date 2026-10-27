import { localDateTimeToISOString } from "./pickerDateFormat";
import type { CityLocation } from "./location";

export interface TripSearchState {
  pickupCity: string;
  pickupLocation: string;
  destinationCity: string;
  destinationLocation: string;
  stops: CityLocation[];
  departureAt: string;
  isRoundTrip: boolean;
  returnAt: string;
  passengerCount: string;
}

type ParamsLike = URLSearchParams | Record<string, string | string[] | undefined>;

function get(params: ParamsLike, key: string): string {
  if (params instanceof URLSearchParams) return params.get(key) ?? "";
  const value = params[key];
  return typeof value === "string" ? value : "";
}

/** Builds the query string carried from the public search into /register, /login, or /requests/new. */
export function tripStateToQueryString(state: TripSearchState): string {
  const q = new URLSearchParams();
  q.set("pickupCity", state.pickupCity);
  q.set("pickupLocation", state.pickupLocation);
  q.set("destinationCity", state.destinationCity);
  q.set("destinationLocation", state.destinationLocation);
  q.set("departureAt", state.departureAt);
  q.set("passengerCount", state.passengerCount);
  if (state.isRoundTrip) {
    q.set("isRoundTrip", "on");
    q.set("returnAt", state.returnAt);
  }
  if (state.stops.length > 0) {
    q.set("stops", JSON.stringify(state.stops));
  }
  return q.toString();
}

/** Reads trip search state from a URL (client `URLSearchParams` or a server `searchParams` object). */
export function readTripSearchState(params: ParamsLike): TripSearchState | null {
  const pickupCity = get(params, "pickupCity");
  const destinationCity = get(params, "destinationCity");
  const departureAt = get(params, "departureAt");
  const passengerCount = get(params, "passengerCount");
  if (!pickupCity || !destinationCity || !departureAt || !passengerCount) {
    return null;
  }

  let stops: CityLocation[] = [];
  const stopsRaw = get(params, "stops");
  if (stopsRaw) {
    try {
      const parsed = JSON.parse(stopsRaw);
      if (Array.isArray(parsed)) {
        stops = parsed.filter(
          (s): s is CityLocation =>
            s && typeof s.city === "string" && typeof s.location === "string",
        );
      }
    } catch {
      stops = [];
    }
  }

  return {
    pickupCity,
    pickupLocation: get(params, "pickupLocation"),
    destinationCity,
    destinationLocation: get(params, "destinationLocation"),
    stops,
    departureAt,
    isRoundTrip: get(params, "isRoundTrip") === "on",
    returnAt: get(params, "returnAt"),
    passengerCount,
  };
}

/** Builds the POST /api/requests payload from carried trip search state. */
export function tripStateToRequestBody(trip: TripSearchState) {
  return {
    pickupCity: trip.pickupCity,
    pickupLocation: trip.pickupLocation,
    destinationCity: trip.destinationCity,
    destinationLocation: trip.destinationLocation,
    stops: trip.stops,
    // See localDateTimeToISOString — converts the bare picker string
    // (carried as-is through the URL up to this point) to a real UTC
    // instant using the browser's own time zone, right before it's sent.
    departureAt: localDateTimeToISOString(trip.departureAt),
    isRoundTrip: trip.isRoundTrip,
    returnAt: trip.isRoundTrip ? localDateTimeToISOString(trip.returnAt) : undefined,
    passengerCount: trip.passengerCount,
  };
}
