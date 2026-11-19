const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Fixed-format date/time for the ride sheet: "Tue 29 Sep" / "13:30" — never
// toLocaleString()/toLocaleDateString(), since those reorder day/month and
// add punctuation inconsistently across locales. Deliberately not
// localized to sr — a known simplification, same as elsewhere in the app's
// ad hoc date formatting.
export function formatShortDate(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function formatTime24(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "Wed 18 Nov, 08:00" — the app's one date-and-time format. */
export function formatShortDateTime(date: Date): string {
  return `${formatShortDate(date)}, ${formatTime24(date)}`;
}
