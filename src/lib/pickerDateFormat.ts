// Short locale-aware date label for the custom DatePicker, e.g. "Sub 26. sep"
// (sr) / "Sat 26. Sep" (en) — built from individual weekday/month parts
// rather than a single Intl.DateTimeFormat call so the day-before-month
// order and the period after the day number stay fixed across locales.
export function formatPickerDate(date: Date, locale: string): string {
  const intlLocale = locale === "sr" ? "sr-Latn" : "en";
  const weekday = new Intl.DateTimeFormat(intlLocale, { weekday: "short" }).format(date);
  const month = new Intl.DateTimeFormat(intlLocale, { month: "short" }).format(date);
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return `${capitalize(weekday)} ${date.getDate()}. ${capitalize(month)}`;
}

export function formatPickerMonthYear(date: Date, locale: string): string {
  const intlLocale = locale === "sr" ? "sr-Latn" : "en";
  const label = new Intl.DateTimeFormat(intlLocale, { month: "long", year: "numeric" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatPickerWeekday(date: Date, locale: string): string {
  const intlLocale = locale === "sr" ? "sr-Latn" : "en";
  return new Intl.DateTimeFormat(intlLocale, { weekday: "narrow" }).format(date);
}

// Date-only <-> "YYYY-MM-DD" <-> "YYYY-MM-DDTHH:mm" helpers, so the
// DatePicker/TimePicker pair can present the existing datetime-local string
// as two fields without changing the underlying field's format.
export function splitDateTimeLocal(value: string): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const [date, time] = value.split("T");
  return { date: date ?? "", time: time ?? "" };
}

export function combineDateTimeLocal(date: string, time: string): string {
  if (!date) return "";
  return `${date}T${time || "00:00"}`;
}

export function parseDateOnly(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function toDateOnlyString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// A "YYYY-MM-DDTHH:mm" datetime-local value has no time zone of its own —
// it's implicitly whoever's local time typed it in. Sending that bare
// string to the server and letting it parse the string itself is wrong:
// Date parsing without an offset falls back to the time zone of whatever
// environment does the parsing, and the server (Vercel, UTC) isn't the
// carrier's or client's time zone — the string would silently shift by
// that offset once stored. `new Date(value)` run here, in the browser,
// correctly resolves it against the browser's own time zone; call this
// right before a departureAt/returnAt field leaves the browser in a
// request body, so what the server stores is an unambiguous UTC instant.
export function localDateTimeToISOString(value: string): string {
  return value ? new Date(value).toISOString() : value;
}
