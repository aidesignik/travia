import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/auth/api";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { resolveCityDisplay } from "@/lib/citySearch";
import { extractRideFromMessage, rideFromMessageEnabled, type RideDraft } from "@/lib/rideFromMessage";

// "Fill from a client's message" in the new-ride form (see
// lib/rideFromMessage.ts). GET says whether the feature is available (an
// ANTHROPIC_API_KEY is set); POST reads a pasted message into form fields.
// Nothing is saved — the form is only pre-filled for the carrier to review.

// Every call is a billable model request, so it's per-user rate-limited.
const LIMIT = 60;
const WINDOW_MS = 60 * 60 * 1000;

const bodySchema = z.object({
  text: z.string().trim().min(1).max(6000),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekday: z.string().max(20),
  timeZone: z.string().max(60),
});

export async function GET() {
  const { error } = await requireApiRole("CARRIER");
  if (error) return error;
  return NextResponse.json({ enabled: rideFromMessageEnabled() });
}

export async function POST(request: Request) {
  const { session, error } = await requireApiRole("CARRIER");
  if (error) return error;
  if (!rideFromMessageEnabled()) {
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { allowed, retryAfterSeconds } = await checkRateLimit(`ride-from-message:${session.user.id}`, LIMIT, WINDOW_MS);
  if (!allowed) {
    return NextResponse.json(
      { error: "TOO_MANY_REQUESTS" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  const raw = await extractRideFromMessage(parsed.data);
  if (!raw) return NextResponse.json({ error: "NOT_READ" }, { status: 422 });

  const draft = cleanDraft(raw);
  const carrier = await prisma.carrier.findUniqueOrThrow({ where: { userId: session.user.id } });
  const client = await matchExistingClient(carrier.id, draft);

  return NextResponse.json({ draft, client });
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function city(value: string | null): string | null {
  const name = text(value);
  return name ? resolveCityDisplay(name, null) : null;
}

// The model's output is schema-shaped but not trusted: blank strings become
// null, malformed dates/times/emails/counts are dropped rather than passed
// on to the form, and city names are mapped onto the app's city list
// ("Belgrade" → "Beograd") the same way the route field does.
function cleanDraft(raw: RideDraft): RideDraft {
  const departureDate = text(raw.departureDate);
  const returnDate = text(raw.returnDate);
  const email = text(raw.clientEmail)?.toLowerCase() ?? null;
  const count = raw.passengerCount;
  return {
    clientCompanyName: text(raw.clientCompanyName),
    clientName: text(raw.clientName),
    clientEmail: email && EMAIL.test(email) ? email : null,
    clientPhone: text(raw.clientPhone),
    pickupCity: city(raw.pickupCity),
    pickupLocation: text(raw.pickupLocation),
    destinationCity: city(raw.destinationCity),
    destinationLocation: text(raw.destinationLocation),
    stops: raw.stops.flatMap((stop) => {
      const name = city(stop.city);
      return name ? [{ city: name, location: text(stop.location) }] : [];
    }).slice(0, 5),
    departureDate: departureDate && DATE.test(departureDate) ? departureDate : null,
    departureTime: raw.departureTime && TIME.test(raw.departureTime.trim()) ? raw.departureTime.trim() : null,
    isRoundTrip: raw.isRoundTrip,
    returnDate: returnDate && DATE.test(returnDate) ? returnDate : null,
    returnTime: raw.returnTime && TIME.test(raw.returnTime.trim()) ? raw.returnTime.trim() : null,
    passengerCount: typeof count === "number" && Number.isInteger(count) && count >= 1 && count <= 200 ? count : null,
    specialRequests: text(raw.specialRequests),
  };
}

// An existing client of this carrier the message is from — by email first,
// then by an exact company-name match when there's exactly one. Scoped to
// clients who already have a ride with this carrier, same as the form's
// client search (api/carrier/clients), so no other carrier's client can be
// looked up this way.
async function matchExistingClient(carrierId: string, draft: RideDraft) {
  const select = { id: true, companyName: true, name: true, email: true, phone: true } as const;
  const scope = { role: "CLIENT" as const, rides: { some: { carrierId } } };
  if (draft.clientEmail) {
    const byEmail = await prisma.user.findFirst({ where: { ...scope, email: draft.clientEmail }, select });
    if (byEmail) return byEmail;
  }
  if (draft.clientCompanyName) {
    const byName = await prisma.user.findMany({
      where: { ...scope, companyName: { equals: draft.clientCompanyName, mode: "insensitive" } },
      select,
      take: 2,
    });
    if (byName.length === 1) return byName[0];
  }
  return null;
}
