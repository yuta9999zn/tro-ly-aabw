import { describe, it, expect, beforeEach } from "vitest";
import { normalize, similarity, checkBefore, recordAnswer, __reset } from "./spam";

beforeEach(() => __reset());

describe("normalize", () => {
  it("strips Vietnamese diacritics, case, and punctuation", () => {
    expect(normalize("Webinar mấy GIỜ?")).toBe("webinar may gio");
    expect(normalize("Đăng ký ở đâu!!")).toBe("dang ky o dau");
  });
});

describe("similarity", () => {
  it("treats reordered same words as equivalent", () => {
    expect(similarity("webinar mấy giờ", "mấy giờ webinar")).toBeGreaterThanOrEqual(0.85);
  });
  it("treats different questions as low similarity", () => {
    expect(similarity("có track nào", "webinar mấy giờ")).toBeLessThan(0.85);
  });
});

describe("checkBefore / recordAnswer", () => {
  it("flags a repeated/equivalent question and returns the prior answer", () => {
    const ip = "1.1.1.1";
    expect(checkBefore(ip, "Webinar mấy giờ?", 1000).repeat).toBe(false);
    recordAnswer(ip, "Webinar mấy giờ?", true, "14:00 giờ VN.", 1000);
    const r = checkBefore(ip, "mấy giờ webinar", 2000);
    expect(r.repeat).toBe(true);
    expect(r.lastAnswer).toBe("14:00 giờ VN.");
  });

  it("blocks after too many off-topic questions", () => {
    const ip = "2.2.2.2";
    for (let i = 0; i < 5; i++) recordAnswer(ip, `random topic alpha${i}`, false, "decline", 1000 + i);
    expect(checkBefore(ip, "yet another random thing", 2000).offTopicBlocked).toBe(true);
  });

  it("does not block when questions are on-topic", () => {
    const ip = "3.3.3.3";
    for (let i = 0; i < 5; i++) recordAnswer(ip, `on topic beta${i}`, true, "ans", 1000 + i);
    expect(checkBefore(ip, "fresh on topic question", 2000).offTopicBlocked).toBe(false);
  });

  it("forgets items older than the window", () => {
    const ip = "4.4.4.4";
    recordAnswer(ip, "Webinar mấy giờ?", true, "14:00", 1000);
    const r = checkBefore(ip, "mấy giờ webinar", 1000 + 6 * 60_000);
    expect(r.repeat).toBe(false);
  });
});
