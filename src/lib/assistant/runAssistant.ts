import Anthropic from "@anthropic-ai/sdk";
import { ASSISTANT_TOOLS, runAssistantTool, type AssistantContext, type RideProposal } from "./tools";

// The in-app chat assistant: a carrier types what they need ("rezerviši
// vožnju 18. u 9h za Mag do Novog Sada, povratak u 15h") and Claude works it
// out with the tools in ./tools.ts — looking up the client, the fleet, who's
// free, the schedule — and prepares a new ride as a confirmation card. It
// never writes to the database itself: the carrier creates the ride from the
// card. Uses the same ANTHROPIC_API_KEY as the document expiry reader.

// Claude Haiku 5.5 by default (cheapest); set ANTHROPIC_ASSISTANT_MODEL to
// e.g. claude-sonnet-5-5 for stronger multi-step reasoning.
const DEFAULT_MODEL = "claude-haiku-5-5";
const MAX_TOOL_ROUNDS = 8;

export function assistantEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface AssistantReply {
  reply: string;
  proposal: RideProposal | null;
}

const INSTRUCTIONS = `You are the assistant inside Travia, a scheduling app for bus and van transport companies (carriers). You help the carrier's dispatcher get things done by chat instead of filling in forms: booking new rides, and answering questions about clients, vehicles, drivers, availability and the schedule.

How to work:
- When the user names a client, look them up with find_clients first. One match: use it (its id and saved contact details). Several matches: ask which one, listing them briefly. No match: it's a new client, so you need at least the contact person's name and email; ask for whatever is missing.
- To book a ride, call propose_ride once you know the client, the destination, and the departure date and time. It shows the user a card with the ride, and the user creates it by clicking the card's button or opens it in the full form to adjust it. You never create rides yourself, so never say a ride "is booked" or "is created"; say you've prepared it for them to confirm.
- If the pickup isn't mentioned, it's the carrier's base city (given below); say so in your reply. If an exact place isn't given, use null for the location (the city stands in).
- If the number of passengers isn't given, ask for it in one short question before proposing, unless the user wants the card right away.
- "Return at 15:00" without a date means the same day. "No stops" means an empty stops list. A return time or date means isRoundTrip is true.
- Only assign a vehicle or driver if the user asks. If they ask for one that's free, use check_availability and pick a free one with enough seats; if none fits, say so.
- Resolve relative dates ("sutra", "18.", "u petak", "next Monday") from today's date below. A date without a month or year is the next such date on or after today. Use 24-hour local times.
- For schedule questions, use list_rides and answer concisely.
- You can't yet change or cancel existing rides, assign drivers to existing rides, or send messages; for those, tell the user to open the ride in the calendar.

Style: reply in the user's language (Serbian in Latin script, with diacritics, when they write Serbian). Be brief and practical, like a helpful colleague: a sentence or two, or a short list. Don't repeat everything the card already shows.`;

function toMessages(history: ChatTurn[]): Anthropic.MessageParam[] {
  // Keep the last turns, starting from a user turn, and merge consecutive
  // turns from the same side (the API wants them alternating).
  const recent = history.slice(-20);
  while (recent.length > 0 && recent[0].role !== "user") recent.shift();
  const messages: Anthropic.MessageParam[] = [];
  for (const turn of recent) {
    const last = messages[messages.length - 1];
    if (last && last.role === turn.role && typeof last.content === "string") {
      last.content = `${last.content}\n\n${turn.text}`;
    } else {
      messages.push({ role: turn.role, content: turn.text });
    }
  }
  return messages;
}

export async function runAssistant(params: {
  ctx: AssistantContext;
  carrierName: string;
  baseCity: string;
  today: string;
  weekday: string;
  history: ChatTurn[];
}): Promise<AssistantReply | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  const model = process.env.ANTHROPIC_ASSISTANT_MODEL?.trim() || DEFAULT_MODEL;

  const client = new Anthropic({ apiKey, timeout: 45_000, maxRetries: 1 });
  const system: Anthropic.TextBlockParam[] = [
    // Stable across every request — cached (with the tool definitions).
    { type: "text", text: INSTRUCTIONS, cache_control: { type: "ephemeral" } },
    {
      type: "text",
      text:
        `Carrier: ${params.carrierName}. Base city: ${params.baseCity}.\n` +
        `Today is ${params.weekday}, ${params.today} (time zone ${params.ctx.timeZone}).`,
    },
  ];
  const messages = toMessages(params.history);
  if (messages.length === 0) return null;

  let proposal: RideProposal | null = null;
  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await client.messages.create({
        model,
        max_tokens: 4000,
        output_config: { effort: "medium" },
        system,
        tools: ASSISTANT_TOOLS,
        messages,
      });

      if (response.stop_reason === "refusal") {
        return { reply: "", proposal: null };
      }

      const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (response.stop_reason === "tool_use" && toolUses.length > 0) {
        // The assistant turn goes back unchanged (thinking blocks included),
        // then every tool result in a single user turn.
        messages.push({ role: "assistant", content: response.content });
        const results = await Promise.all(
          toolUses.map(async (use): Promise<Anthropic.ToolResultBlockParam> => {
            try {
              const out = await runAssistantTool(params.ctx, use.name, use.input as Record<string, unknown>);
              if (out.proposal) proposal = out.proposal;
              return { type: "tool_result", tool_use_id: use.id, content: JSON.stringify(out.result) };
            } catch (err) {
              console.warn(`[assistant] tool ${use.name} failed:`, err);
              return { type: "tool_result", tool_use_id: use.id, content: "The lookup failed.", is_error: true };
            }
          }),
        );
        messages.push({ role: "user", content: results });
        continue;
      }

      const reply = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { reply, proposal };
    }
    return { reply: "", proposal };
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.warn(`[assistant] API error ${err.status}: ${err.message}`);
    } else {
      console.warn("[assistant] failed:", err);
    }
    return null;
  }
}
