// The assistant talks in the carrier's local wall-clock time ("18. nov u
// 9h"), but the database stores instants. These convert between a local
// "YYYY-MM-DDTHH:mm" in a given IANA time zone and a Date, on the server
// (whose own zone is UTC on Vercel) — the browser does the same with
// localDateTimeToISOString when it actually creates the ride.

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

// Offset of `timeZone` from UTC at instant `ms`, in milliseconds.
function zoneOffsetMs(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** "2026-11-18T09:00" in Europe/Belgrade → the matching instant, or null. */
export function zonedLocalToDate(local: string, timeZone: string): Date | null {
  const m = LOCAL.exec(local);
  if (!m) return null;
  const wall = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  try {
    // Two passes settle the offset across a DST change.
    let guess = wall - zoneOffsetMs(wall, timeZone);
    guess = wall - zoneOffsetMs(guess, timeZone);
    return new Date(guess);
  } catch {
    return null;
  }
}

/** An instant → "YYYY-MM-DDTHH:mm" wall-clock time in `timeZone`. */
export function dateToZonedLocal(date: Date, timeZone: string): string {
  const shifted = new Date(date.getTime() + zoneOffsetMs(date.getTime(), timeZone));
  return shifted.toISOString().slice(0, 16);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}
