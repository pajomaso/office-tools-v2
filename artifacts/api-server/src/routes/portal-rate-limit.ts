// Small in-memory rate limiter (one server instance). Counts events per key in a sliding window.
// If the app ever runs on several instances, move this to the database or Redis.
export function limiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, t] of hits) { const keep = t.filter((x) => now - x < windowMs); if (keep.length) hits.set(k, keep); else hits.delete(k); }
  }, Math.min(windowMs, 10 * 60_000));
  sweep.unref();
  return {
    /** True when the key is over the limit; otherwise records this hit and returns false. */
    hit(key: string): boolean {
      const now = Date.now();
      const t = (hits.get(key) ?? []).filter((x) => now - x < windowMs);
      if (t.length >= max) { hits.set(key, t); return true; }
      t.push(now); hits.set(key, t);
      return false;
    },
  };
}
