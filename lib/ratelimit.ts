const WINDOW_MS = 60_000;
const MAX = 10;
const hits = new Map<string, { count: number; start: number }>();

/** Allow at most MAX requests per IP per WINDOW_MS. In-memory (single instance). */
export function allow(ip: string, now: number = Date.now()): boolean {
  const rec = hits.get(ip);
  if (!rec || now - rec.start >= WINDOW_MS) {
    hits.set(ip, { count: 1, start: now });
    return true;
  }
  if (rec.count >= MAX) return false;
  rec.count += 1;
  return true;
}
