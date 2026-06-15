// Spam/abuse guard: (a) repeated/equivalent questions, (b) too many off-topic questions.
// Per-IP, in-memory, sliding window. Saves Claude tokens by short-circuiting abuse.

const WINDOW_MS = 5 * 60_000; // 5 minutes
const SIMILAR_THRESHOLD = 0.85; // Jaccard token overlap → "equivalent"
const OFFTOPIC_MAX = 5; // off-topic answers within window before blocking

interface Item {
  norm: string;
  tokens: Set<string>;
  answer: string;
  covered: boolean;
  ts: number;
}

const state = new Map<string, Item[]>();

/** Lowercase, strip Vietnamese diacritics, drop punctuation, collapse spaces. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // combining diacritics
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTokens(s: string): Set<string> {
  return new Set(normalize(s).split(" ").filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Token-overlap similarity between two questions (0..1). */
export function similarity(q1: string, q2: string): number {
  return jaccard(toTokens(q1), toTokens(q2));
}

function pruned(ip: string, now: number): Item[] {
  const items = (state.get(ip) ?? []).filter((it) => now - it.ts < WINDOW_MS);
  state.set(ip, items);
  return items;
}

export interface SpamVerdict {
  repeat: boolean;
  lastAnswer?: string;
  offTopicBlocked: boolean;
}

/** Check a new question BEFORE calling Claude. */
export function checkBefore(ip: string, question: string, now: number = Date.now()): SpamVerdict {
  const items = pruned(ip, now);
  const tokens = toTokens(question);

  const match = items.find((it) => jaccard(tokens, it.tokens) >= SIMILAR_THRESHOLD);
  const offTopicCount = items.filter((it) => !it.covered).length;

  return {
    repeat: match !== undefined,
    lastAnswer: match?.answer,
    offTopicBlocked: offTopicCount >= OFFTOPIC_MAX,
  };
}

/** Record the question + its gate result AFTER answering (for future checks). */
export function recordAnswer(
  ip: string,
  question: string,
  covered: boolean,
  answer: string,
  now: number = Date.now(),
): void {
  const items = pruned(ip, now);
  items.push({ norm: normalize(question), tokens: toTokens(question), answer, covered, ts: now });
  state.set(ip, items);
}

/** Test helper: clear all state. */
export function __reset(): void {
  state.clear();
}
