export const APP_TIME_ZONE = "America/Barbados";

const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Calendar date (YYYY-MM-DD) in Barbados, regardless of the device time zone. */
export function barbadosToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Wall-clock time (HH:MM, 24h) in Barbados. */
export function barbadosTime(now = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
}

export function addDays(iso: string, days: number) {
  return toIsoDate(new Date(parseIsoDate(iso).getTime() + days * DAY_MS));
}

export function addWeeks(iso: string, weeks: number) {
  return addDays(iso, weeks * 7);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(iso: string) {
  return parseIsoDate(iso).getUTCDay();
}

/** Same date or the next date that falls on the given weekday. */
export function nextWeekday(iso: string, day: number) {
  return addDays(iso, (day - weekday(iso) + 7) % 7);
}

function format(iso: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(parseIsoDate(iso));
}

/** "22 Sep 2026" */
export const formatDate = (iso: string) => format(iso, { day: "numeric", month: "short", year: "numeric" });
/** "22 Sep" */
export const formatShortDate = (iso: string) => format(iso, { day: "numeric", month: "short" });
/** "Tuesday, 22 September" */
export const formatLongDate = (iso: string) => `${format(iso, { weekday: "long" })}, ${format(iso, { day: "numeric", month: "long" })}`;
/** "Tuesdays" */
export const weekdayPlural = (iso: string) => `${format(iso, { weekday: "long" })}s`;
/** "Aug 2026" */
export const formatMonthYear = (iso: string) => format(iso, { month: "short", year: "numeric" });

/** "19:42" → "7:42 PM" */
export function formatTime(hhmm: string) {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** "Today, 7:42 PM", "Yesterday, 3:20 PM" or "20 Sep 2026, 6:15 PM". */
export function formatEventTime(date: string, time: string, today: string) {
  const day = date === today ? "Today" : date === addDays(today, -1) ? "Yesterday" : formatDate(date);
  return `${day}, ${formatTime(time)}`;
}
