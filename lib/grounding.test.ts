import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  parseGateResult,
  declineMessage,
  COVERAGE_SCHEMA,
} from "./grounding";

describe("buildSystemPrompt", () => {
  it("embeds the KB and the grounding rules and the language", () => {
    const sys = buildSystemPrompt("F01. test fact", "vi");
    expect(sys).toContain("F01. test fact");
    expect(sys).toContain("covered");
    expect(sys).toContain("tiếng Việt");
  });
  it("switches instruction language for en", () => {
    expect(buildSystemPrompt("kb", "en")).toContain("English");
  });
});

describe("parseGateResult", () => {
  it("returns covered answer with citations", () => {
    const r = parseGateResult({ covered: true, citations: ["F03"], answer: "Lên DevPost." }, "vi");
    expect(r.covered).toBe(true);
    expect(r.answer).toBe("Lên DevPost.");
    expect(r.citations).toEqual(["F03"]);
  });
  it("returns decline when not covered", () => {
    const r = parseGateResult({ covered: false, citations: [], answer: "" }, "vi");
    expect(r.covered).toBe(false);
    expect(r.answer).toContain("Discord");
    expect(r.citations).toEqual([]);
  });
  it("fails safe to decline on malformed input", () => {
    const r = parseGateResult({ junk: true } as unknown as Record<string, unknown>, "vi");
    expect(r.covered).toBe(false);
    expect(r.answer).toContain("Discord");
  });
});

describe("declineMessage", () => {
  it("differs by language and both point to Discord", () => {
    expect(declineMessage("vi")).toContain("Discord");
    expect(declineMessage("en")).toContain("Discord");
    expect(declineMessage("vi")).not.toEqual(declineMessage("en"));
  });
});

describe("COVERAGE_SCHEMA", () => {
  it("requires the three gate fields", () => {
    expect(COVERAGE_SCHEMA.required).toEqual(["covered", "citations", "answer"]);
    expect(COVERAGE_SCHEMA.additionalProperties).toBe(false);
  });
});
