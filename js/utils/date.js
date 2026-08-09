/* Dates are handled in the writer's own local time.
   A "day key" is YYYY-MM-DD — never a UTC timestamp, so a page written
   at 11pm belongs to that evening and not to tomorrow. */

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function dayKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function monthKey(value) {
  return (value instanceof Date ? dayKey(value) : String(value)).slice(0, 7);
}

/** Parse YYYY-MM-DD into a local Date at midnight. */
export function keyToDate(key) {
  if (key instanceof Date) return key;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(key));
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function todayKey() {
  return dayKey(new Date());
}

/** "Sunday, August 9" */
export function longDate(key, { withYear = false } = {}) {
  const d = keyToDate(key);
  if (!d) return "";
  const base = `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return withYear ? `${base}, ${d.getFullYear()}` : base;
}

/** "August 9, 2026" */
export function plainDate(key) {
  const d = keyToDate(key);
  if (!d) return "";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "August, 2026" */
export function monthTitle(ymKey) {
  const [year, month] = String(ymKey).split("-").map(Number);
  if (!year || !month) return "";
  return `${MONTHS[month - 1]}, ${year}`;
}

/** "9:42 pm" */
export function timeOfDay(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  let hours = d.getHours();
  const suffix = hours >= 12 ? "pm" : "am";
  hours = hours % 12 || 12;
  return `${hours}:${String(d.getMinutes()).padStart(2, "0")} ${suffix}`;
}

/** Whole days between two day keys (b - a). */
export function daysBetween(aKey, bKey) {
  const a = keyToDate(aKey);
  const b = keyToDate(bKey);
  if (!a || !b) return 0;
  return Math.round((b - a) / 86400000);
}

/** dawn · day · dusk · night — drives the ambient warmth. */
export function partOfDay(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return "night";
  if (h < 9) return "dawn";
  if (h < 17) return "day";
  if (h < 21) return "dusk";
  return "night";
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return "Still awake.";
  if (h < 12) return "Good morning.";
  if (h < 17) return "Good afternoon.";
  return "Good evening.";
}

/** "just now" · "2 minutes ago" · "yesterday" */
export function relativeTime(iso) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = daysBetween(dayKey(new Date(then)), todayKey());
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return plainDate(dayKey(new Date(then)));
}

/** Days in a month, and the weekday its first falls on (0 = Sunday). */
export function monthGrid(ymKey) {
  const [year, month] = String(ymKey).split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const total = new Date(year, month, 0).getDate();
  return { year, month, offset: first.getDay(), total };
}

export function shiftMonth(ymKey, delta) {
  const [year, month] = String(ymKey).split("-").map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
