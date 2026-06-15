import { describe, it, expect, vi } from "vitest";
import { runGate } from "./gate";

function fakeClient(jsonText: string) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: jsonText }] }),
    },
  } as unknown as import("@anthropic-ai/sdk").default;
}

describe("runGate", () => {
  it("returns a covered answer from a well-formed model response", async () => {
    const client = fakeClient(
      JSON.stringify({ covered: true, citations: ["F03"], answer: "Lên DevPost." }),
    );
    const r = await runGate("Nộp bài ở đâu?", "vi", client);
    expect(r.covered).toBe(true);
    expect(r.citations).toEqual(["F03"]);
    expect(r.answer).toBe("Lên DevPost.");
  });

  it("declines when the model says not covered", async () => {
    const client = fakeClient(JSON.stringify({ covered: false, citations: [], answer: "" }));
    const r = await runGate("KFC có giảm giá không?", "vi", client);
    expect(r.covered).toBe(false);
    expect(r.answer).toContain("Discord");
  });

  it("declines on non-JSON model output (fail-safe)", async () => {
    const client = fakeClient("not json at all");
    const r = await runGate("anything", "en", client);
    expect(r.covered).toBe(false);
    expect(r.answer).toContain("Discord");
  });
});
