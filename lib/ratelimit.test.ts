import { describe, it, expect } from "vitest";
import { allow } from "./ratelimit";

describe("allow", () => {
  it("permits up to the limit then blocks within the window", () => {
    const ip = "1.2.3.4";
    const now = 1_000_000;
    for (let i = 0; i < 10; i++) expect(allow(ip, now)).toBe(true);
    expect(allow(ip, now)).toBe(false); // 11th in same window
  });
  it("resets after the window passes", () => {
    const ip = "5.6.7.8";
    for (let i = 0; i < 10; i++) allow(ip, 2_000_000);
    expect(allow(ip, 2_000_000 + 61_000)).toBe(true);
  });
});
