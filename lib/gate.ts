import type Anthropic from "@anthropic-ai/sdk";
import { loadKnowledge } from "./knowledge";
import {
  buildSystemPrompt,
  parseGateResult,
  COVERAGE_SCHEMA,
  type GateResult,
  type Lang,
} from "./grounding";

/** Extract the first text block and JSON.parse it; null on any failure. */
function safeJson(content: unknown): unknown {
  if (!Array.isArray(content)) return null;
  const block = content.find(
    (b) => b && typeof b === "object" && (b as { type?: string }).type === "text",
  ) as { text?: string } | undefined;
  if (!block?.text) return null;
  try {
    return JSON.parse(block.text);
  } catch {
    return null;
  }
}

/** Run the coverage gate for one question. `client` is injectable for tests. */
export async function runGate(question: string, lang: Lang, client: Anthropic): Promise<GateResult> {
  const system = buildSystemPrompt(loadKnowledge(), lang);
  const params = {
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema: COVERAGE_SCHEMA } },
    messages: [{ role: "user", content: question }],
  };
  // `output_config` (structured outputs) may not be in this SDK version's typed params yet.
  const res = await client.messages.create(
    params as unknown as Anthropic.MessageCreateParamsNonStreaming,
  );
  return parseGateResult(safeJson((res as { content: unknown }).content), lang);
}
