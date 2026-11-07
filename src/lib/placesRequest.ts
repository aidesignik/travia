import { NextResponse } from "next/server";
import { auth } from "@/auth/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import type { PlacesLanguage } from "@/lib/googleMaps";

// Shared guard for the /api/places/* endpoints behind the "exact location"
// search field. Signed-in users only, and rate-limited per user: every call
// is a billable Google request, so neither endpoint may be usable as an
// open proxy. (Signed-out visitors simply get the plain text field.)
const LIMIT = 400;
const WINDOW_MS = 10 * 60 * 1000;

const SESSION_TOKEN = /^[A-Za-z0-9_-]{8,64}$/;

export async function guardPlacesRequest(
  request: Request,
): Promise<{ error: NextResponse } | { sessionToken: string; language: PlacesLanguage; params: URLSearchParams }> {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
  }

  const params = new URL(request.url).searchParams;
  const sessionToken = params.get("session") ?? "";
  if (!SESSION_TOKEN.test(sessionToken)) {
    return { error: NextResponse.json({ error: "INVALID_SESSION" }, { status: 400 }) };
  }

  const { allowed, retryAfterSeconds } = await checkRateLimit(`places:${session.user.id}`, LIMIT, WINDOW_MS);
  if (!allowed) {
    return {
      error: NextResponse.json(
        { error: "TOO_MANY_REQUESTS" },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
      ),
    };
  }

  const language: PlacesLanguage = params.get("lang") === "sr" ? "sr" : "en";
  return { sessionToken, language, params };
}
