import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { checkAvailability } from "@/lib/availability";
import { resolveCityDisplay } from "@/lib/citySearch";
import { estimateRouteDistance } from "@/lib/tripDistance";
import { dateToZonedLocal, zonedLocalToDate } from "./zonedTime";

// The assistant's tools. Everything here only READS the carrier's own data
// (scoped by carrierId on every query) — except propose_ride, which doesn't
// write anything either: it builds a ride proposal that the chat shows as a
// confirmation card, and the ride is only created when the carrier clicks
// "Create ride" on it (through the normal /api/carrier/rides/quick route,
// with all its usual validation).

export interface AssistantContext {
  carrierId: string;
  timeZone: string;
}

export interface RideProposal {
  clientId: string | null;
  clientCompanyName: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  pickupCity: string;
  pickupLocation: string;
  destinationCity: string;
  destinationLocation: string;
  stops: { city: string; location: string }[];
  // Local wall-clock "YYYY-MM-DDTHH:mm" in the carrier's time zone.
  departureAt: string;
  isRoundTrip: boolean;
  returnAt: string | null;
  passengerCount: number | null;
  specialRequests: string;
  vehicle: { id: string; label: string } | null;
  driver: { id: string; name: string } | null;
  distanceKm: number | null;
  // Fields "Create ride" still needs (shown on the card; the carrier can
  // fill them in through "Open in form" instead).
  missing: string[];
}

const VEHICLE_TYPE_LABEL: Record<string, string> = {
  VAN: "Kombi",
  MINIBUS: "Minibus",
  MIDIBUS: "Midibus",
  COACH: "Autobus",
  DOUBLE_DECKER: "Dvospratni autobus",
};

const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ONE_WAY_SPAN_MS = 4 * 60 * 60 * 1000;

const nullableString = { type: ["string", "null"] } as const;

export const ASSISTANT_TOOLS: Anthropic.Tool[] = [
  {
    name: "find_clients",
    description:
      "Search this carrier's existing clients (people and companies they've driven for before) by company name, contact name or email. Use it whenever the user names a client, to get the client's id and saved contact details.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Part of the company name, contact name or email." } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "list_fleet",
    description: "List the carrier's active vehicles (with seats and plate) and available drivers, with their ids.",
    strict: true,
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    name: "check_availability",
    description:
      "Which vehicles and drivers are free or already busy (another ride or a block such as maintenance or a day off) for a trip. Times are local, \"YYYY-MM-DDTHH:mm\". Leave returnAt null for a one-way trip.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        departureAt: { type: "string", description: "Local departure, YYYY-MM-DDTHH:mm." },
        returnAt: { ...nullableString, description: "Local time the return leg leaves, YYYY-MM-DDTHH:mm, or null." },
      },
      required: ["departureAt", "returnAt"],
      additionalProperties: false,
    },
  },
  {
    name: "list_rides",
    description:
      "List the carrier's rides between two dates (inclusive), optionally only one client's. Use it to answer questions about the schedule.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        fromDate: { type: "string", description: "YYYY-MM-DD" },
        toDate: { type: "string", description: "YYYY-MM-DD" },
        client: { ...nullableString, description: "Part of a client's company or contact name, or null for all." },
      },
      required: ["fromDate", "toDate", "client"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_ride",
    description:
      "Prepare a new ride and show it to the user as a confirmation card. This does NOT create the ride: the user creates it by clicking the card's button (or opens it in the form to adjust it). Call it once you know the client, the destination and the departure date and time. Times are local, \"YYYY-MM-DDTHH:mm\". Use null for anything unknown.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        clientId: { ...nullableString, description: "The id from find_clients, or null for a new client." },
        clientCompanyName: nullableString,
        clientName: { ...nullableString, description: "Contact person." },
        clientEmail: nullableString,
        clientPhone: nullableString,
        pickupCity: { type: "string" },
        pickupLocation: { ...nullableString, description: "Exact place in the pickup city, or null." },
        destinationCity: { type: "string" },
        destinationLocation: { ...nullableString, description: "Exact place in the destination city, or null." },
        stops: {
          type: "array",
          description: "Stops on the way, in order. Empty for none.",
          items: {
            type: "object",
            properties: { city: { type: "string" }, location: nullableString },
            required: ["city", "location"],
            additionalProperties: false,
          },
        },
        departureAt: { type: "string", description: "Local departure, YYYY-MM-DDTHH:mm." },
        isRoundTrip: { type: "boolean" },
        returnAt: { ...nullableString, description: "Local time the return leg leaves, YYYY-MM-DDTHH:mm, or null for one way." },
        passengerCount: { type: ["integer", "null"] },
        specialRequests: nullableString,
        vehicleId: { ...nullableString, description: "Only if the user asked to assign a vehicle." },
        driverId: { ...nullableString, description: "Only if the user asked to assign a driver." },
      },
      required: [
        "clientId",
        "clientCompanyName",
        "clientName",
        "clientEmail",
        "clientPhone",
        "pickupCity",
        "pickupLocation",
        "destinationCity",
        "destinationLocation",
        "stops",
        "departureAt",
        "isRoundTrip",
        "returnAt",
        "passengerCount",
        "specialRequests",
        "vehicleId",
        "driverId",
      ],
      additionalProperties: false,
    },
  },
];

type Input = Record<string, unknown>;
const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

function vehicleLabel(v: { type: string; model: string; licensePlate: string | null; seats: number }) {
  const plate = v.licensePlate ? ` · ${v.licensePlate}` : "";
  return `${VEHICLE_TYPE_LABEL[v.type] ?? v.type} ${v.model}${plate} · ${v.seats} mesta`;
}

const clientScope = (carrierId: string) => ({ role: "CLIENT" as const, rides: { some: { carrierId } } });
const clientSelect = { id: true, companyName: true, name: true, email: true, phone: true } as const;

async function findClients(ctx: AssistantContext, input: Input) {
  const query = str(input.query);
  if (!query) return { clients: [] };
  const clients = await prisma.user.findMany({
    where: {
      ...clientScope(ctx.carrierId),
      OR: [
        { companyName: { contains: query, mode: "insensitive" } },
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
      ],
    },
    select: clientSelect,
    take: 8,
  });
  return { clients };
}

async function listFleet(ctx: AssistantContext) {
  const [vehicles, drivers] = await Promise.all([
    prisma.vehicle.findMany({ where: { carrierId: ctx.carrierId, status: "ACTIVE" }, orderBy: { createdAt: "asc" } }),
    prisma.driver.findMany({ where: { carrierId: ctx.carrierId, isAvailable: true }, orderBy: { createdAt: "asc" } }),
  ]);
  return {
    vehicles: vehicles.map((v) => ({ id: v.id, label: vehicleLabel(v), seats: v.seats })),
    drivers: drivers.map((d) => ({ id: d.id, name: d.name })),
  };
}

function tripWindow(ctx: AssistantContext, departureAt: string, returnAt: string | null) {
  const start = LOCAL_DATETIME.test(departureAt) ? zonedLocalToDate(departureAt, ctx.timeZone) : null;
  if (!start) return null;
  const back = returnAt && LOCAL_DATETIME.test(returnAt) ? zonedLocalToDate(returnAt, ctx.timeZone) : null;
  return { start, end: back && back > start ? back : new Date(start.getTime() + ONE_WAY_SPAN_MS) };
}

async function checkFleetAvailability(ctx: AssistantContext, input: Input) {
  const window = tripWindow(ctx, str(input.departureAt), str(input.returnAt) || null);
  if (!window) return { error: "departureAt must be YYYY-MM-DDTHH:mm" };
  const fleet = await listFleet(ctx);
  const describe = (conflicts: { start: Date; end: Date }[]) =>
    conflicts[0]
      ? `busy ${dateToZonedLocal(conflicts[0].start, ctx.timeZone)} – ${dateToZonedLocal(conflicts[0].end, ctx.timeZone)}`
      : "free";
  const [vehicles, drivers] = await Promise.all([
    Promise.all(
      fleet.vehicles.map(async (v) => {
        const result = await checkAvailability({ vehicleId: v.id, ...window });
        return { ...v, status: describe(result.conflicts) };
      }),
    ),
    Promise.all(
      fleet.drivers.map(async (d) => {
        const result = await checkAvailability({ driverId: d.id, ...window });
        return { ...d, status: describe(result.conflicts) };
      }),
    ),
  ]);
  return { vehicles, drivers };
}

async function listRides(ctx: AssistantContext, input: Input) {
  const fromDate = str(input.fromDate);
  const toDate = str(input.toDate);
  if (!DATE.test(fromDate) || !DATE.test(toDate)) return { error: "dates must be YYYY-MM-DD" };
  const from = zonedLocalToDate(`${fromDate}T00:00`, ctx.timeZone);
  const toStart = zonedLocalToDate(`${toDate}T00:00`, ctx.timeZone);
  if (!from || !toStart) return { error: "invalid dates" };
  const to = new Date(toStart.getTime() + 24 * 60 * 60 * 1000);
  const client = str(input.client);

  const rides = await prisma.ride.findMany({
    where: {
      carrierId: ctx.carrierId,
      departureAt: { lt: to },
      OR: [{ departureAt: { gte: from } }, { returnAt: { gte: from } }],
      ...(client
        ? {
            client: {
              OR: [
                { companyName: { contains: client, mode: "insensitive" } },
                { name: { contains: client, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    include: { client: { select: { companyName: true, name: true } }, vehicle: true, driver: { select: { name: true } } },
    orderBy: { departureAt: "asc" },
    take: 40,
  });

  return {
    rides: rides.map((r) => ({
      departure: dateToZonedLocal(r.departureAt, ctx.timeZone),
      return: r.returnAt ? dateToZonedLocal(r.returnAt, ctx.timeZone) : null,
      route: `${r.pickupCity} ${r.isRoundTrip ? "⇄" : "→"} ${r.destinationCity}`,
      client: r.client.companyName || r.client.name || "",
      passengers: r.passengerCount,
      vehicle: r.vehicle ? vehicleLabel(r.vehicle) : null,
      driver: r.driver?.name ?? null,
      status: r.status,
    })),
  };
}

async function routeDistanceKm(proposal: RideProposal): Promise<number | null> {
  const there = [
    { city: proposal.pickupCity, location: proposal.pickupLocation },
    ...proposal.stops,
    { city: proposal.destinationCity, location: proposal.destinationLocation },
  ];
  const estimate = async () => {
    const out = await estimateRouteDistance(there);
    if (!out) return null;
    if (!proposal.isRoundTrip) return Math.round(out.distanceKm);
    // Same route back, reversed (no separate return route from chat yet).
    const back = await estimateRouteDistance([...there].reverse());
    return back ? Math.round(out.distanceKm + back.distanceKm) : null;
  };
  // A slow distance lookup must not hold up the chat reply.
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000));
  return Promise.race([estimate().catch(() => null), timeout]);
}

async function buildProposal(ctx: AssistantContext, input: Input): Promise<RideProposal> {
  const clientId = str(input.clientId);
  const saved = clientId
    ? await prisma.user.findFirst({ where: { id: clientId, ...clientScope(ctx.carrierId) }, select: clientSelect })
    : null;

  const city = (value: unknown) => {
    const name = str(value);
    return name ? resolveCityDisplay(name, null) : "";
  };
  const pickupCity = city(input.pickupCity);
  const destinationCity = city(input.destinationCity);
  const stops = Array.isArray(input.stops)
    ? input.stops.flatMap((s: Input) => {
        const c = city(s?.city);
        return c ? [{ city: c, location: str(s?.location) || c }] : [];
      }).slice(0, 5)
    : [];

  const departureAt = LOCAL_DATETIME.test(str(input.departureAt)) ? str(input.departureAt) : "";
  const rawReturn = LOCAL_DATETIME.test(str(input.returnAt)) ? str(input.returnAt) : null;
  const isRoundTrip = input.isRoundTrip === true || Boolean(rawReturn);
  const returnAt = isRoundTrip && rawReturn && (!departureAt || rawReturn > departureAt) ? rawReturn : null;

  const count = typeof input.passengerCount === "number" ? input.passengerCount : null;
  const passengerCount = count && Number.isInteger(count) && count >= 1 && count <= 200 ? count : null;

  const [vehicle, driver] = await Promise.all([
    str(input.vehicleId)
      ? prisma.vehicle.findFirst({ where: { id: str(input.vehicleId), carrierId: ctx.carrierId } })
      : null,
    str(input.driverId) ? prisma.driver.findFirst({ where: { id: str(input.driverId), carrierId: ctx.carrierId } }) : null,
  ]);

  const email = (saved?.email ?? str(input.clientEmail)).toLowerCase();
  const proposal: RideProposal = {
    clientId: saved?.id ?? null,
    clientCompanyName: saved?.companyName ?? str(input.clientCompanyName),
    clientName: saved?.name ?? str(input.clientName),
    clientEmail: EMAIL.test(email) ? email : "",
    clientPhone: saved?.phone ?? str(input.clientPhone),
    pickupCity,
    // No exact place given: the city itself stands in, editable in the form.
    pickupLocation: str(input.pickupLocation) || pickupCity,
    destinationCity,
    destinationLocation: str(input.destinationLocation) || destinationCity,
    stops,
    departureAt,
    isRoundTrip,
    returnAt,
    passengerCount,
    specialRequests: str(input.specialRequests),
    vehicle: vehicle ? { id: vehicle.id, label: vehicleLabel(vehicle) } : null,
    driver: driver ? { id: driver.id, name: driver.name } : null,
    distanceKm: null,
    missing: [],
  };

  const missing: string[] = [];
  if (!proposal.clientName) missing.push("clientName");
  if (!proposal.clientEmail) missing.push("clientEmail");
  if (!proposal.pickupCity) missing.push("pickup");
  if (!proposal.destinationCity) missing.push("destination");
  if (!proposal.departureAt) missing.push("departureAt");
  if (proposal.isRoundTrip && !proposal.returnAt) missing.push("returnAt");
  if (!proposal.passengerCount) missing.push("passengerCount");
  proposal.missing = missing;

  if (proposal.pickupCity && proposal.destinationCity) proposal.distanceKm = await routeDistanceKm(proposal);
  return proposal;
}

/**
 * Runs one tool call. Returns what the model sees, plus the proposal when
 * the tool was propose_ride (the chat shows it as a card).
 */
export async function runAssistantTool(
  ctx: AssistantContext,
  name: string,
  input: Input,
): Promise<{ result: unknown; proposal?: RideProposal }> {
  switch (name) {
    case "find_clients":
      return { result: await findClients(ctx, input) };
    case "list_fleet":
      return { result: await listFleet(ctx) };
    case "check_availability":
      return { result: await checkFleetAvailability(ctx, input) };
    case "list_rides":
      return { result: await listRides(ctx, input) };
    case "propose_ride": {
      const proposal = await buildProposal(ctx, input);
      return {
        proposal,
        result: {
          shownToUser: true,
          missing: proposal.missing,
          note: "The ride is NOT created yet; the user creates it from the card (or opens it in the form).",
        },
      };
    }
    default:
      return { result: { error: `Unknown tool ${name}` } };
  }
}
