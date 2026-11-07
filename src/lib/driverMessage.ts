import { formatLocation, type CityLocation } from "./location";

// Click-to-send ride details for the assigned driver (RideDetailDrawer's
// "Send to driver" row): builds the message text and the WhatsApp / Viber
// / SMS links that open the dispatcher's own app with the driver's number
// and that text pre-filled. Nothing is sent by Travia itself — the
// dispatcher reviews the message and presses send in their app.

/**
 * A driver's phone as international digits without "+" (e.g.
 * "381641234567"), which is what wa.me and the Viber/SMS links need.
 * Numbers in local format ("064 123 4567") are assumed to be Serbian.
 * Null when it can't be a real phone number.
 */
export function toInternationalDigits(raw: string, defaultCountryCode = "381"): string | null {
  let value = raw.trim().replace(/[^\d+]/g, "");
  if (value.startsWith("00")) value = `+${value.slice(2)}`;

  let digits: string;
  if (value.startsWith("+")) digits = value.slice(1).replace(/\D/g, "");
  else if (value.startsWith(defaultCountryCode)) digits = value;
  else if (value.startsWith("0")) digits = defaultCountryCode + value.slice(1);
  else digits = defaultCountryCode + value;

  return digits.length >= 9 && digits.length <= 15 ? digits : null;
}

export interface DriverMessageLabels {
  title: string;
  departure: string;
  stop: string;
  returnTrip: string;
  vehicle: string;
  passengers: string;
  client: string;
  note: string;
  map: string;
}

export interface DriverMessageInput {
  /** e.g. "Ned 8. nov, 09:00" */
  departureText: string;
  pickup: CityLocation;
  stops: CityLocation[];
  destination: CityLocation;
  /** Present for a round trip. */
  returnTrip?: { text: string; pickup: CityLocation; stops: CityLocation[]; destination: CityLocation } | null;
  vehicleText?: string | null;
  passengerCount: number;
  clientText?: string | null;
  note?: string | null;
}

/** A Google Maps search link for an address — opens navigation in one tap, no API involved. */
export function mapsLink(place: CityLocation): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatLocation(place))}`;
}

export function buildDriverMessage(input: DriverMessageInput, labels: DriverMessageLabels): string {
  const route = (pickup: CityLocation, stops: CityLocation[], destination: CityLocation) => [
    formatLocation(pickup),
    ...stops.filter((s) => s.city).map((s) => `${labels.stop}: ${formatLocation(s)}`),
    `→ ${formatLocation(destination)}`,
  ];

  const lines = [
    `🚌 ${labels.title} · ${input.departureText}`,
    "",
    `${labels.departure}:`,
    ...route(input.pickup, input.stops, input.destination),
  ];
  if (input.returnTrip) {
    lines.push(
      "",
      `${labels.returnTrip}: ${input.returnTrip.text}`,
      ...route(input.returnTrip.pickup, input.returnTrip.stops, input.returnTrip.destination),
    );
  }
  lines.push("");
  if (input.vehicleText) lines.push(`${labels.vehicle}: ${input.vehicleText}`);
  lines.push(`${labels.passengers}: ${input.passengerCount}`);
  if (input.clientText) lines.push(`${labels.client}: ${input.clientText}`);
  if (input.note?.trim()) lines.push(`${labels.note}: ${input.note.trim()}`);
  lines.push("", `${labels.map}: ${mapsLink(input.pickup)}`);
  return lines.join("\n");
}

export function messagingLinks(digits: string, text: string) {
  const body = encodeURIComponent(text);
  return {
    whatsapp: `https://wa.me/${digits}?text=${body}`,
    viber: `viber://chat?number=%2B${digits}&draft=${body}`,
    // "?&body=" is the form both iOS and Android accept.
    sms: `sms:+${digits}?&body=${body}`,
  };
}
