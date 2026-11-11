import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireApiRole } from "@/auth/api";
import { prisma } from "@/lib/prisma";
import { formatRoute } from "@/lib/location";
import { clientDisplayName } from "@/lib/clientDisplay";

const PER_GROUP = 5;
const MAX_QUERY = 100;
const MAX_WORDS = 6;

export interface SearchRide {
  id: string;
  route: string;
  client: string;
  departureAt: string;
  status: string;
}

export interface SearchResults {
  rides: SearchRide[];
  requests: SearchRide[];
  vehicles: { id: string; model: string; licensePlate: string | null; seats: number }[];
  drivers: { id: string; name: string; phone: string }[];
  notes: { id: string; title: string; snippet: string }[];
}

const contains = (value: string) => ({ contains: value, mode: "insensitive" as const });

// Every word has to match at least one of the fields, so "oxford smith"
// finds Oxford rides for the client Smith.
function everyWord<T>(words: string[], fieldsFor: (word: string) => T[]): { AND: { OR: T[] }[] } {
  return { AND: words.map((word) => ({ OR: fieldsFor(word) })) };
}

function rideFields(word: string): Prisma.RideWhereInput[] {
  return [
    { pickupCity: contains(word) },
    { pickupLocation: contains(word) },
    { destinationCity: contains(word) },
    { destinationLocation: contains(word) },
    { specialRequests: contains(word) },
    { client: { OR: [{ name: contains(word) }, { companyName: contains(word) }] } },
    { vehicle: { OR: [{ model: contains(word) }, { licensePlate: contains(word) }] } },
    { driver: { name: contains(word) } },
    { stops: { some: { OR: [{ city: contains(word) }, { location: contains(word) }] } } },
  ];
}

const RIDE_SELECT = {
  id: true,
  pickupCity: true,
  pickupLocation: true,
  destinationCity: true,
  destinationLocation: true,
  departureAt: true,
  status: true,
  client: { select: { name: true, companyName: true } },
} satisfies Prisma.RideSelect;

type RideRow = Prisma.RideGetPayload<{ select: typeof RIDE_SELECT }>;

function toSearchRide(ride: RideRow): SearchRide {
  return {
    id: ride.id,
    route: formatRoute(ride),
    client: clientDisplayName(ride.client),
    departureAt: ride.departureAt.toISOString(),
    status: ride.status,
  };
}

// Rides closest to today first (upcoming and recent before old history).
function byNearest(rows: RideRow[], now: number) {
  return [...rows].sort(
    (a, b) => Math.abs(a.departureAt.getTime() - now) - Math.abs(b.departureAt.getTime() - now),
  );
}

// The top bar's search: the carrier's rides, vehicles, drivers and notes,
// plus open requests, matching the query. A few of each — the results list
// is for jumping to something, not browsing.
export async function GET(request: Request) {
  const { session, error } = await requireApiRole("CARRIER");
  if (error) return error;

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY);
  const words = q.split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);
  const empty: SearchResults = { rides: [], requests: [], vehicles: [], drivers: [], notes: [] };
  if (q.length < 2 || words.length === 0) return NextResponse.json(empty);

  const carrier = await prisma.carrier.findUniqueOrThrow({ where: { userId: session.user.id } });
  const now = Date.now();

  const [rides, requests, vehicles, drivers, notes] = await Promise.all([
    prisma.ride.findMany({
      where: {
        carrierId: carrier.id,
        status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] },
        ...everyWord(words, rideFields),
      },
      select: RIDE_SELECT,
      orderBy: { departureAt: "desc" },
      take: 40,
    }),
    prisma.ride.findMany({
      where: { carrierId: null, status: "PENDING", ...everyWord(words, rideFields) },
      select: RIDE_SELECT,
      orderBy: { departureAt: "asc" },
      take: PER_GROUP,
    }),
    prisma.vehicle.findMany({
      where: {
        carrierId: carrier.id,
        ...everyWord<Prisma.VehicleWhereInput>(words, (word) => [
          { model: contains(word) },
          { licensePlate: contains(word) },
          { otherAmenities: contains(word) },
        ]),
      },
      select: { id: true, model: true, licensePlate: true, seats: true },
      orderBy: { model: "asc" },
      take: PER_GROUP,
    }),
    prisma.driver.findMany({
      where: {
        carrierId: carrier.id,
        ...everyWord<Prisma.DriverWhereInput>(words, (word) => [
          { name: contains(word) },
          { phone: contains(word) },
          { licenseNumber: contains(word) },
        ]),
      },
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
      take: PER_GROUP,
    }),
    prisma.note.findMany({
      where: {
        carrierId: carrier.id,
        ...everyWord<Prisma.NoteWhereInput>(words, (word) => [
          { title: contains(word) },
          { body: contains(word) },
          { attachments: { some: { fileName: contains(word) } } },
        ]),
      },
      select: { id: true, title: true, body: true },
      orderBy: [{ position: "asc" }, { updatedAt: "desc" }],
      take: PER_GROUP,
    }),
  ]);

  const results: SearchResults = {
    rides: byNearest(rides, now).slice(0, PER_GROUP).map(toSearchRide),
    requests: requests.map(toSearchRide),
    vehicles,
    drivers,
    notes: notes.map((note) => ({
      id: note.id,
      title: note.title,
      snippet: note.body.replace(/\s+/g, " ").slice(0, 120),
    })),
  };
  return NextResponse.json(results);
}
