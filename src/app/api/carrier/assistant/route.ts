import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/auth/api";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { assistantEnabled, runAssistant } from "@/lib/assistant/runAssistant";
import { isValidTimeZone } from "@/lib/assistant/zonedTime";

// The in-app chat assistant (see lib/assistant). GET says whether it's
// available (an ANTHROPIC_API_KEY is set); POST takes the conversation so far
// and returns the assistant's reply, plus a ride proposal when it prepared
// one. Nothing is written here — rides are created from the proposal card
// through the normal quick-create route.

// Each message can take several model calls (tool rounds), so it's
// rate-limited per user.
const LIMIT = 120;
const WINDOW_MS = 60 * 60 * 1000;

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(6000) }))
    .min(1)
    .max(40)
    .refine((list) => list[list.length - 1].role === "user", { message: "last message must be from the user" }),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekday: z.string().max(20),
  timeZone: z.string().max(60),
});

export async function GET() {
  const { error } = await requireApiRole("CARRIER");
  if (error) return error;
  return NextResponse.json({ enabled: assistantEnabled() });
}

export async function POST(request: Request) {
  const { session, error } = await requireApiRole("CARRIER");
  if (error) return error;
  if (!assistantEnabled()) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { allowed, retryAfterSeconds } = await checkRateLimit(`assistant:${session.user.id}`, LIMIT, WINDOW_MS);
  if (!allowed) {
    return NextResponse.json(
      { error: "TOO_MANY_REQUESTS" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  const carrier = await prisma.carrier.findUniqueOrThrow({
    where: { userId: session.user.id },
    select: { id: true, companyName: true, city: true },
  });
  const timeZone = isValidTimeZone(parsed.data.timeZone) ? parsed.data.timeZone : "Europe/Belgrade";

  const result = await runAssistant({
    ctx: { carrierId: carrier.id, timeZone },
    carrierName: carrier.companyName,
    baseCity: carrier.city,
    today: parsed.data.today,
    weekday: parsed.data.weekday,
    history: parsed.data.messages,
  });
  if (!result) return NextResponse.json({ error: "ASSISTANT_FAILED" }, { status: 502 });
  return NextResponse.json(result);
}
