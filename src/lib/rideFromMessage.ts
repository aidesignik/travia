import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";

// "Fill from a client's message" in the new-ride form: the carrier pastes a
// booking request as it arrived (email, Viber, SMS — Serbian or English) and
// Claude Haiku reads it into the form's fields. Nothing is saved here: the
// result only pre-fills the form, which the carrier reviews and submits as
// usual. Everything is optional — a field the message doesn't mention comes
// back null and the form leaves it as it was.
//
// Uses the same ANTHROPIC_API_KEY as the document expiry reader
// (documentExpiry.ts); without it the feature is simply hidden.

const MODEL = "claude-haiku-5-5";

export function rideFromMessageEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

const StopSchema = z.object({
  city: z.string(),
  location: z.string().nullable(),
});

const RideDraftSchema = z.object({
  clientCompanyName: z.string().nullable(),
  clientName: z.string().nullable(),
  clientEmail: z.string().nullable(),
  clientPhone: z.string().nullable(),
  pickupCity: z.string().nullable(),
  pickupLocation: z.string().nullable(),
  destinationCity: z.string().nullable(),
  destinationLocation: z.string().nullable(),
  stops: z.array(StopSchema),
  departureDate: z.string().nullable(),
  departureTime: z.string().nullable(),
  isRoundTrip: z.boolean().nullable(),
  returnDate: z.string().nullable(),
  returnTime: z.string().nullable(),
  passengerCount: z.number().nullable(),
  specialRequests: z.string().nullable(),
});

export type RideDraft = z.infer<typeof RideDraftSchema>;

const SYSTEM_PROMPT = `You read booking requests that clients send to a bus and van transport company in Serbia (by email, Viber, WhatsApp or SMS, usually in Serbian, sometimes in English or mixed) and extract the details of the requested ride into the given fields.

Rules:
- Only use what the message says. If something isn't mentioned, return null for it (or an empty list for stops). Never guess a client's name, email, phone, date or passenger count.
- Write Serbian names in Latin script with diacritics (Beograd, Niš, Čačak), even if the message uses Cyrillic or leaves out diacritics.
- City fields hold just the town or city (e.g. "Beograd", "Novi Sad", "Budimpešta"). Location fields hold the exact place in that city when one is given: a hotel, address, airport, school, square or venue (e.g. "Hotel Moskva", "Aerodrom Nikola Tesla", "Bulevar oslobođenja 12"). If only a city is named, the location is null.
- Stops are places visited on the way to the destination, in order.
- Dates are YYYY-MM-DD and times HH:mm (24-hour). Resolve relative dates ("sutra", "u petak", "next Monday") from today's date given below. A date without a year is the next such date on or after today.
- isRoundTrip is true when the client wants to be brought back (povratak, return, "i nazad", a return date or time), false when they clearly want one way, and null when it isn't clear. returnDate and returnTime are when the return leg leaves.
- passengerCount is the number of people travelling, as a number.
- clientCompanyName is the organisation booking (company, school, club, agency), if any; clientName is the contact person. Copy the email and phone exactly as written.
- specialRequests: a short note, in the message's language, of anything else the driver or dispatcher needs to know (luggage, child seats, a sign with a name, accessibility, waiting time, extra stops described loosely). Null if there is nothing.`;

/**
 * The ride details in a pasted client message, or null when the API key
 * isn't set, the request fails, or the model declines — callers then show a
 * "couldn't read the message" note and the form stays as it was.
 */
export async function extractRideFromMessage(params: {
  text: string;
  // The carrier's own date and time zone, for resolving "sutra" / "u petak".
  today: string;
  weekday: string;
  timeZone: string;
}): Promise<RideDraft | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const client = new Anthropic({ apiKey, timeout: 30_000, maxRetries: 1 });
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      // Extraction from a short message: low effort keeps it fast and cheap.
      output_config: { effort: "low", format: zodOutputFormat(RideDraftSchema) },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content:
            `Today is ${params.weekday}, ${params.today} (time zone ${params.timeZone}).\n\n` +
            `Client's message:\n<message>\n${params.text}\n</message>`,
        },
      ],
    });

    // A declined request comes back as HTTP 200 with stop_reason "refusal"
    // (Haiku has no server-side fallback) — check before reading output.
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
      console.warn(`[rideFromMessage] no draft: stop_reason=${response.stop_reason}`);
      return null;
    }
    return response.parsed_output ?? null;
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.warn(`[rideFromMessage] API error ${err.status}: ${err.message}`);
    } else {
      console.warn("[rideFromMessage] failed:", err);
    }
    return null;
  }
}
