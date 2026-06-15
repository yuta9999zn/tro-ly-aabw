import { describe, it, expect } from "vitest";
import { loadKnowledge } from "./knowledge";

describe("loadKnowledge", () => {
  it("returns the KB text containing fact codes", () => {
    const kb = loadKnowledge();
    expect(kb.length).toBeGreaterThan(200);
    expect(kb).toContain("F01");
    expect(kb).toContain("Builder Experience");
  });
});
