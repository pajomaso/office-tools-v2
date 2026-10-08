// The office is in Braga: every rule (opening hours, cancellation cut-offs, month boundaries)
// is evaluated on the Europe/Lisbon wall clock, whatever the server's or the browser's timezone is.
export const TZ = "Europe/Lisbon";

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
});

export type Parts = { y: number; m: number; d: number; h: number; min: number; dow: number; date: string; month: string };

export function partsOf(at: Date): Parts {
  const p = Object.fromEntries(fmt.formatToParts(at).map((x) => [x.type, x.value]));
  const y = +p.year, m = +p.month, d = +p.day, h = +p.hour, min = +p.minute;
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { y, m, d, h, min, dow, date: `${y}-${pad(m)}-${pad(d)}`, month: `${y}-${pad(m)}` };
}

function offsetMs(at: number) {
  const p = partsOf(new Date(at));
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - Math.floor(at / 60_000) * 60_000;
}

/** Wall-clock time in Lisbon ("2026-10-26", "09:00") → the real instant. Handles DST. */
export function lisbonToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  let t = guess - offsetMs(guess);
  t = guess - offsetMs(t); // second pass settles the DST boundary
  return new Date(t);
}

export const isValidDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const isValidTime = (s: unknown): s is string => typeof s === "string" && /^\d{2}:\d{2}$/.test(s);
