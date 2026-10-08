// The office is in Braga. Everything on screen is shown in Europe/Lisbon time, whatever the
// browser's timezone is, and calendar days travel as "YYYY-MM-DD" strings so they never shift.
export const TZ = "Europe/Lisbon";
export const OPEN = 8;
export const CLOSE = 20;

const pad = (n: number) => String(n).padStart(2, "0");
const fmtParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function lisbon(at: Date | string) {
  const p = Object.fromEntries(fmtParts.formatToParts(new Date(at)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, h: +p.hour, min: +p.minute, time: `${p.hour}:${p.minute}` };
}
export const hm = (at: Date | string) => lisbon(at).time;
export const ymd = (at: Date | string) => lisbon(at).date;
export const hourOf = (at: Date | string) => { const l = lisbon(at); return l.h + l.min / 60; };
export const todayStr = () => ymd(new Date());

const utc = (s: string, h = 12) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d, h)); };
export const addDays = (s: string, n: number) => { const d = utc(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const mondayOf = (s: string) => addDays(s, -((utc(s).getUTCDay() + 6) % 7));
export const isWeekend = (s: string) => [0, 6].includes(utc(s).getUTCDay());
export const nextWorkday = (s: string) => { let d = s; while (isWeekend(d)) d = addDays(d, 1); return d; };
export const fmtDay = (s: string, o: Intl.DateTimeFormatOptions) => utc(s).toLocaleDateString("en-GB", { timeZone: "UTC", ...o });

function offsetMs(at: number) {
  const l = lisbon(new Date(at));
  const [y, m, d] = l.date.split("-").map(Number);
  return Date.UTC(y, m - 1, d, l.h, l.min) - Math.floor(at / 60_000) * 60_000;
}
/** Lisbon wall-clock → real instant (DST-safe). */
export function lisbonToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  let t = guess - offsetMs(guess);
  t = guess - offsetMs(t);
  return new Date(t);
}

// Access is 24/7. Starts run 00:00–23:30; ends run 00:30–23:30 and then 24:00 (midnight, end of the same day).
const halfHours = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => { const m = (from + i) * 30; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; });
export const startOptions = () => halfHours(0, 47);
export const endOptions = () => [...halfHours(1, 47), "24:00"];
export const plusHour = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const mins = Math.min(24 * 60, h * 60 + m + 60);
  return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
};
