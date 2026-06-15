import { readFileSync } from "node:fs";
import { join } from "node:path";

let cached: string | null = null;

/** Load the official AABW knowledge base markdown as a string (cached). */
export function loadKnowledge(): string {
  if (cached === null) {
    cached = readFileSync(join(process.cwd(), "content", "aabw-knowledge.md"), "utf8");
  }
  return cached;
}
