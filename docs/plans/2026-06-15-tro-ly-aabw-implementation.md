# Trợ lý AABW — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Vietnamese+English web chat bot ("Trợ lý AABW") that answers questions about Agentic AI Build Week strictly from an official knowledge base, and declines (no hallucination) when a question is not covered.

**Architecture:** Next.js (App Router) single-page chat. One POST `/api/chat` route handler calls Claude Haiku 4.5 with the full knowledge base in a prompt-cached system prompt and a structured-output "coverage gate" (`{covered, citations, answer}`). `covered=false` → standard decline + pointer to Discord. v0 returns a single JSON response (non-streaming) — the gate uses structured output, so non-streaming JSON is cleaner and robust; Haiku answers are short and fast. Deploy on Hostinger VPS via a copy-paste prompt for "Claude edge" (Kaori does not SSH in).

**Tech Stack:** Next.js 16 + TypeScript + Tailwind, `@anthropic-ai/sdk` (`claude-haiku-4-5`), Vitest for unit tests. Project root: `D:\AABW Guide`.

---

## File Structure

| File | Responsibility |
|---|---|
| `content/aabw-knowledge.md` | Official AABW facts, each tagged `Fxx`. Data only. |
| `lib/knowledge.ts` | Load the markdown KB as a string (server-side). |
| `lib/grounding.ts` | Pure helpers: `buildSystemPrompt`, `COVERAGE_SCHEMA`, `parseGateResult`, `declineMessage`, `DISCLOSURE`. |
| `lib/gate.ts` | `runGate(question, lang, client)` — calls Claude with structured output, returns normalized result. Client injectable for tests. |
| `lib/ratelimit.ts` | Simple in-memory per-IP token-bucket. |
| `app/api/chat/route.ts` | POST handler: validate body → rate-limit → `runGate` → JSON response. |
| `app/page.tsx` | Chat UI: VN/EN toggle, message list, input, disclosure badge + citations. |
| `app/layout.tsx`, `app/globals.css` | Shell + Tailwind. |
| `lib/*.test.ts` | Vitest unit tests. |
| `README.md` | Run + deploy notes. |
| `DEPLOY_PROMPT.md` | Copy-paste prompt for Claude edge to provision the VPS. |

---

## Task 0: Scaffold the Next.js project

**Files:**
- Create: project scaffold in `D:\AABW Guide` (alongside existing `docs/`, `.git/`)

- [ ] **Step 1: Scaffold with create-next-app (into existing dir)**

Run from `D:\AABW Guide`:
```bash
npx create-next-app@latest . --ts --tailwind --app --eslint --no-src-dir --use-npm --import-alias "@/*" --yes
```
Accept Turbopack default if prompted. The existing `docs/` and `.git/` are preserved (create-next-app only errors on conflicting files like an existing `package.json`).

- [ ] **Step 2: Install runtime + test deps**

```bash
npm i @anthropic-ai/sdk
npm i -D vitest
```

- [ ] **Step 3: Add test script + vitest config**

Add to `package.json` `"scripts"`: `"test": "vitest run"`, `"test:watch": "vitest"`.

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["lib/**/*.test.ts"] },
});
```

- [ ] **Step 4: Verify dev server boots**

Run: `npm run dev`
Expected: server starts on `http://localhost:3000`, default Next page loads. Stop with Ctrl+C.

- [ ] **Step 5: Add `.env.example` and gitignore check**

Create `.env.example`:
```
ANTHROPIC_API_KEY=sk-ant-...
```
Confirm `.gitignore` (from create-next-app) already ignores `.env*`. If not, add `.env*.local` and `.env`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + Tailwind + vitest"
```

---

## Task 1: Knowledge base content + loader

**Files:**
- Create: `content/aabw-knowledge.md`
- Create: `lib/knowledge.ts`
- Test: `lib/knowledge.test.ts`

- [ ] **Step 1: Write the knowledge base**

Create `content/aabw-knowledge.md` (facts sourced from the official AABW email; each fact has a `Fxx` code so the model can cite it):

```markdown
# AABW — Dữ liệu chính thức (official knowledge base)

F01. Agentic AI Build Week (AABW) là buildathon lớn nhất khu vực, tổ chức tại TP.HCM (Ho Chi Minh City).
F02. Tuần sự kiện chính diễn ra 08–12/07/2026 (July 8–12, 2026).
F03. Lập team và nộp bài trên DevPost. Không có team trên DevPost = không thi được.
F04. Các track hiện có: Mobility (Tasco), Gaming (VNG Games), F&B (KFC), Retail (Phong Vũ), Aviation (Vietjet), Real Estate (Nova Group), Built with AWS (Amazon Web Services). Sẽ có thêm track.
F05. Mỗi track chỉ có 60 slot nộp bài, theo thứ tự đăng ký trước (first come, first served). Track đầy là đóng.
F06. Builder Experience Awards là track khởi động (warm-up) có thể bắt đầu ngay trước tuần chính. Build AI tool/agent/workflow giúp builder của AABW (team matching, workshop copilot, support bot, deadline tracker...).
F07. Tool thắng Builder Experience Awards do cộng đồng vote, được deploy live cho hàng nghìn builder trong AABW.
F08. Builder Experience Awards: nộp bài đóng khoảng 20/06/2026; công bố winner tại webinar 23/06.
F09. Webinar briefing: 23/06/2026, 14:00 (2PM) giờ Việt Nam. Hướng dẫn cách buildathon chạy, các track, tiêu chí chấm. Đăng ký để nhận Zoom link qua email.
F10. Mọi cập nhật quan trọng, thông báo và link đăng ký workshop CHỈ phát trong nhóm Discord và WhatsApp — KHÔNG gửi qua email.
F11. Discord có bot Clawbie hỗ trợ trả lời về sự kiện. Link sign-up workshop nằm ở kênh Discord "aabw-workshops".
F12. Workshops ngày 08/07: "Render the Next Era of Creation with the BytePlus AI Stack" (BytePlus); "Inside the NVIDIA Inception Program" (NVIDIA); "TRAE in Your Professional Workflow" (TRAE).
F13. Workshops ngày 10/07: "Build, Deploy and Monetize AI Agents" (Apify); "Beyond Autocomplete: How Agentic AI Solves the Enterprise Design Bottleneck" (Google Developers).
F14. Seat workshop có hạn, hết nhanh. Link đăng ký thả trong nhóm Discord/WhatsApp.
F15. Có thể submit sự kiện cộng đồng của bạn (workshop, demo night, meetup từ nay đến 12/07) để được feature trên trang AABW.
F16. AABW đang tìm volunteer hỗ trợ tổ chức.
F17. Checklist builder: đăng ký webinar 23/06; bắt đầu build ở track Builder Experience (đóng 20/06); join Discord + WhatsApp; chọn workshop; submit sự kiện cộng đồng; volunteer.
```

- [ ] **Step 2: Write the failing test**

Create `lib/knowledge.test.ts`:
```ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `loadKnowledge` not found / cannot import `./knowledge`.

- [ ] **Step 4: Implement the loader**

Create `lib/knowledge.ts`:
```ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add content/aabw-knowledge.md lib/knowledge.ts lib/knowledge.test.ts
git commit -m "feat: AABW knowledge base + loader"
```

---

## Task 2: Grounding helpers (pure functions)

**Files:**
- Create: `lib/grounding.ts`
- Test: `lib/grounding.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/grounding.test.ts`:
```ts
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
    expect(sys).toContain("covered"); // mentions the gate contract
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot import `./grounding`.

- [ ] **Step 3: Implement the grounding helpers**

Create `lib/grounding.ts`:
```ts
export type Lang = "vi" | "en";

export interface GateResult {
  covered: boolean;
  answer: string;
  citations: string[];
}

/** Machine-readable AI disclosure (port of Kaori K-24). */
export const DISCLOSURE = {
  generated_by_ai: true,
  model: "claude-haiku-4-5",
  source: "AABW official knowledge base",
} as const;

/** JSON schema for the coverage gate structured output. */
export const COVERAGE_SCHEMA = {
  type: "object",
  properties: {
    covered: { type: "boolean" },
    citations: { type: "array", items: { type: "string" } },
    answer: { type: "string" },
  },
  required: ["covered", "citations", "answer"],
  additionalProperties: false,
} as const;

export function declineMessage(lang: Lang): string {
  return lang === "vi"
    ? "Mình chưa có thông tin này trong dữ liệu AABW chính thức. Bạn hỏi trực tiếp ở Discord AABW (kênh #ask-clawbie) nhé."
    : "I don't have this in the official AABW knowledge base yet. Please ask directly in the AABW Discord (#ask-clawbie channel).";
}

/** Build the system prompt: KB + strict grounding rules (port of Kaori |OR| / K-3). */
export function buildSystemPrompt(kb: string, lang: Lang): string {
  const langRule =
    lang === "vi"
      ? "Trả lời bằng tiếng Việt, ngắn gọn, giọng thân thiện."
      : "Answer in English, concise and friendly. The knowledge base is in Vietnamese — translate the facts, do not add information.";
  return [
    "Bạn là Trợ lý AABW — trợ lý sự kiện Agentic AI Build Week.",
    "",
    "QUY TẮC GROUNDING (bắt buộc):",
    "1. Chỉ trả lời từ KNOWLEDGE BASE bên dưới. Tuyệt đối không dùng kiến thức ngoài về AABW.",
    "2. Mọi câu trả lời phải map được tới ≥1 mã fact (Fxx). Nếu không map được → covered=false.",
    "3. Không chắc = covered=false. Thà từ chối còn hơn bịa.",
    `4. ${langRule}`,
    "5. Trả về JSON: covered (bool), citations (mảng mã Fxx đã dùng), answer (chuỗi).",
    "   - covered=true → answer là câu trả lời; citations liệt kê các Fxx.",
    "   - covered=false → answer để chuỗi rỗng; citations rỗng (hệ thống sẽ tự chèn câu từ chối).",
    "",
    "=== KNOWLEDGE BASE ===",
    kb,
    "=== HẾT KNOWLEDGE BASE ===",
  ].join("\n");
}

/** Normalize + fail-safe the model's structured output. Unknown shape → decline. */
export function parseGateResult(raw: unknown, lang: Lang): GateResult {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const covered = obj.covered === true;
  const citations = Array.isArray(obj.citations)
    ? (obj.citations.filter((c) => typeof c === "string") as string[])
    : [];
  const answer = typeof obj.answer === "string" ? obj.answer.trim() : "";
  if (!covered || answer === "") {
    return { covered: false, answer: declineMessage(lang), citations: [] };
  }
  return { covered: true, answer, citations };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all grounding + knowledge tests green).

- [ ] **Step 5: Commit**

```bash
git add lib/grounding.ts lib/grounding.test.ts
git commit -m "feat: grounding helpers (system prompt, coverage gate parse, decline)"
```

---

## Task 3: Gate runner (Claude call, injectable client)

**Files:**
- Create: `lib/gate.ts`
- Test: `lib/gate.test.ts`

- [ ] **Step 1: Write the failing test (mock the Claude client)**

Create `lib/gate.test.ts`:
```ts
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
    const client = fakeClient(JSON.stringify({ covered: true, citations: ["F03"], answer: "Lên DevPost." }));
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot import `./gate`.

- [ ] **Step 3: Implement the gate runner**

Create `lib/gate.ts`:
```ts
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
  const res = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema: COVERAGE_SCHEMA } },
    messages: [{ role: "user", content: question }],
  } as Anthropic.MessageCreateParamsNonStreaming);
  return parseGateResult(safeJson((res as { content: unknown }).content), lang);
}
```

> Note: `output_config` may not yet be in the installed SDK's typed params; the `as ...NonStreaming` cast covers that. If TypeScript still complains about `output_config`, widen the create arg to `as any` for that one call and leave a `// SDK structured-output param` comment.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/gate.ts lib/gate.test.ts
git commit -m "feat: gate runner calling Claude Haiku 4.5 with structured output"
```

---

## Task 4: Rate limit helper

**Files:**
- Create: `lib/ratelimit.ts`
- Test: `lib/ratelimit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/ratelimit.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot import `./ratelimit`.

- [ ] **Step 3: Implement the rate limiter**

Create `lib/ratelimit.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ratelimit.ts lib/ratelimit.test.ts
git commit -m "feat: in-memory per-IP rate limit"
```

---

## Task 5: Chat API route

**Files:**
- Create: `app/api/chat/route.ts`

- [ ] **Step 1: Implement the route handler**

Create `app/api/chat/route.ts`:
```ts
import Anthropic from "@anthropic-ai/sdk";
import { runGate } from "@/lib/gate";
import { allow } from "@/lib/ratelimit";
import { DISCLOSURE, type Lang } from "@/lib/grounding";

export const runtime = "nodejs";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allow(ip)) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: { question?: unknown; lang?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const lang: Lang = body.lang === "en" ? "en" : "vi";
  if (question.length === 0 || question.length > 500) {
    return Response.json({ error: "bad_question" }, { status: 400 });
  }

  try {
    const result = await runGate(question, lang, client);
    return Response.json({ ...result, disclosure: DISCLOSURE });
  } catch (e) {
    console.error("gate error", e);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Manually verify the route (needs a real key)**

Create `.env.local` with `ANTHROPIC_API_KEY=sk-ant-...` (your key). Run `npm run dev`, then:
```bash
curl -s http://localhost:3000/api/chat -H "content-type: application/json" \
  -d '{"question":"Nộp bài ở đâu?","lang":"vi"}'
```
Expected: JSON with `covered: true`, an `answer`, `citations` containing `F03`, and a `disclosure` object.

Then an off-KB question:
```bash
curl -s http://localhost:3000/api/chat -H "content-type: application/json" \
  -d '{"question":"KFC có khuyến mãi gà rán không?","lang":"vi"}'
```
Expected: `covered: false`, `answer` containing "Discord".

- [ ] **Step 3: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat: /api/chat route with rate limit + grounding gate"
```

---

## Task 6: Chat UI

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx` (title)

- [ ] **Step 1: Set the page title**

In `app/layout.tsx`, set `metadata`:
```ts
export const metadata = { title: "Trợ lý AABW", description: "Hỏi đáp Agentic AI Build Week — không bịa." };
```

- [ ] **Step 2: Implement the chat page**

Replace `app/page.tsx` with:
```tsx
"use client";
import { useState } from "react";

type Lang = "vi" | "en";
interface Msg {
  role: "user" | "bot";
  text: string;
  citations?: string[];
  covered?: boolean;
}

const T = {
  vi: {
    title: "Trợ lý AABW",
    tagline: "Hỏi đáp Agentic AI Build Week — trả lời từ dữ liệu chính thức, không bịa.",
    placeholder: "Hỏi về track, deadline, workshop...",
    send: "Gửi",
    thinking: "Đang tra dữ liệu...",
    source: "Nguồn",
    disclosure: "Tạo bởi AI · nguồn AABW chính thức · claude-haiku-4-5",
    error: "Có lỗi xảy ra, thử lại nhé.",
  },
  en: {
    title: "AABW Guide",
    tagline: "Ask about Agentic AI Build Week — answers from official data, no hallucination.",
    placeholder: "Ask about tracks, deadlines, workshops...",
    send: "Send",
    thinking: "Checking the data...",
    source: "Source",
    disclosure: "AI-generated · source: AABW official · claude-haiku-4-5",
    error: "Something went wrong, please retry.",
  },
} as const;

export default function Home() {
  const [lang, setLang] = useState<Lang>("vi");
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const t = T[lang];

  async function send() {
    const q = input.trim();
    if (!q || loading) return;
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "error");
      setMsgs((m) => [...m, { role: "bot", text: data.answer, citations: data.citations, covered: data.covered }]);
    } catch {
      setMsgs((m) => [...m, { role: "bot", text: t.error }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex h-screen max-w-2xl flex-col p-4">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t.title}</h1>
          <p className="text-sm text-gray-500">{t.tagline}</p>
        </div>
        <button
          onClick={() => setLang(lang === "vi" ? "en" : "vi")}
          className="rounded border px-2 py-1 text-sm"
        >
          {lang === "vi" ? "EN" : "VI"}
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto rounded border p-3">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <div
              className={
                "inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm " +
                (m.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900")
              }
            >
              {m.text}
              {m.role === "bot" && m.citations && m.citations.length > 0 && (
                <div className="mt-1 text-xs text-gray-500">
                  {t.source}: {m.citations.join(", ")}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="text-sm text-gray-400">{t.thinking}</div>}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={t.placeholder}
          className="flex-1 rounded border px-3 py-2 text-sm"
        />
        <button onClick={send} disabled={loading} className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">
          {t.send}
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-gray-400">{t.disclosure}</p>
    </main>
  );
}
```

- [ ] **Step 3: Manually verify the UI**

Run `npm run dev`, open `http://localhost:3000`. Ask "Nộp bài ở đâu?" → bot answers with a source line (F03). Toggle EN, ask "When is the briefing webinar?" → English answer (F09). Ask an off-KB question → decline pointing to Discord.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx app/layout.tsx
git commit -m "feat: chat UI with VN/EN toggle, citations, disclosure badge"
```

---

## Task 7: Smoke test + README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Full unit suite green**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Production build sanity**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 3: Manual smoke (5 questions)**

With `npm run dev` + a real key, ask:
1. "Có những track nào?" → covered, cites F04.
2. "Deadline track warm-up khi nào?" → covered, cites F08.
3. "Webinar mấy giờ?" → covered, cites F09.
4. "Vé máy bay Vietjet giá bao nhiêu?" → decline (off-KB).
5. "What's the prize for the hackathon?" (EN) → decline if not in KB, in English.

Confirm none of the answers invent facts beyond the KB.

- [ ] **Step 4: Write README**

Create `README.md`:
```markdown
# Trợ lý AABW

Grounded support bot for Agentic AI Build Week. Answers strictly from `content/aabw-knowledge.md`; declines (no hallucination) when a question is not covered. VN + EN.

## Dev
1. `npm ci`
2. Create `.env.local` with `ANTHROPIC_API_KEY=sk-ant-...`
3. `npm run dev` → http://localhost:3000

## Test
`npm test`

## Update the knowledge base
Edit `content/aabw-knowledge.md` (keep the `Fxx` codes), then `npm run build` + redeploy.

## Deploy
Hostinger VPS — see `DEPLOY_PROMPT.md` (a copy-paste prompt for an agent with SSH access).
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: README + smoke checklist"
```

---

## Task 8: Deploy prompt for Claude edge

**Files:**
- Create: `DEPLOY_PROMPT.md`

- [ ] **Step 1: Write the copy-paste deploy prompt**

Create `DEPLOY_PROMPT.md` — this is the deliverable Kaori hands to "Claude edge" (an agent with SSH access to the VPS). Kaori does NOT run it.

```markdown
# Deploy prompt — paste to Claude edge (has SSH to the VPS)

You have SSH root access to a Hostinger VPS (Ubuntu 24.04 LTS, KVM2) at 31.97.70.221.
**This VPS already runs another production project. Deploy "Trợ lý AABW" ALONGSIDE it WITHOUT
disrupting the existing app.** Do all of this:

0. INVENTORY FIRST (do not change anything yet). Record and report:
   - `ss -ltnp` (which ports are in use — the existing app's port must stay untouched)
   - `pm2 list` (existing PM2 processes — do not stop/restart/delete any of them)
   - `ls /etc/nginx/sites-enabled/` + read existing server blocks (do not edit them)
   - `ufw status` (is the firewall active? which ports are already allowed?)
   - existing Node version (`node -v`) and whether it's managed by nvm
   Pick a FREE internal port for this app (e.g. 3100) — verify it's not in `ss -ltnp`.
1. Harden: create a non-root user `deploy` with sudo, copy the authorized SSH key to it,
   run the app as `deploy` (not root). For ufw: if INACTIVE, do NOT enable it blindly (could cut
   the existing app) — only enable after explicitly allowing 22/80/443 AND every port the existing
   app needs; if ACTIVE, just ensure 22/80/443 are allowed. When unsure, leave ufw as-is and report.
2. Install Node.js LTS for the `deploy` user via **nvm** (do NOT change the system/global Node the
   existing app may rely on). `npm i -g pm2` is fine (pm2 runs many apps independently). nginx +
   certbot are likely already installed (the other app uses them) — `apt install -y` only if missing.
3. As `deploy`: `git clone <REPO_URL> ~/tro-ly-aabw && cd ~/tro-ly-aabw && npm ci && npm run build`.
4. Create `~/tro-ly-aabw/.env.local` containing `ANTHROPIC_API_KEY=<KEY>` (chmod 600). Never log the key.
5. Start on the dedicated port: `PORT=3100 pm2 start "npm run start" --name tro-ly-aabw`
   (Next.js `next start` honors PORT). `pm2 save`. Run `pm2 startup` ONLY if pm2 isn't already
   set to start on boot (check first — the existing app likely already configured it).
6. nginx: ADD A NEW server block file (e.g. `/etc/nginx/sites-available/tro-ly-aabw`) for <SUBDOMAIN>
   → `proxy_pass http://127.0.0.1:3100;` (with proxy headers). Symlink into sites-enabled.
   **Do not modify the existing app's server block.** `nginx -t && systemctl reload nginx`
   (reload, not restart — reload doesn't drop the existing app's connections).
7. SSL: `certbot --nginx -d <SUBDOMAIN>` (HTTPS + auto-renew) — scope to the new subdomain only.
8. Verify (and confirm the existing app still responds on its own domain/port):
   `curl -s https://<SUBDOMAIN>/api/chat -H 'content-type: application/json' -d '{"question":"Có những track nào?","lang":"vi"}'`
   should return JSON with covered=true and citations.

Report: the inventory from step 0, the final public URL, and confirmation the existing project is
unaffected. Placeholders to fill before running: <REPO_URL>, <KEY>, <SUBDOMAIN>, authorized SSH key.
```

- [ ] **Step 2: Commit**

```bash
git add DEPLOY_PROMPT.md
git commit -m "docs: Claude-edge deploy prompt for Hostinger VPS"
```

---

## Self-Review notes

- **Spec coverage:** §2 architecture → Tasks 0–6; §3 grounding gate → Tasks 2–3; §4 disclosure → `DISCLOSURE` (Task 2) + UI badge (Task 6); §5 Claude API → Task 3; §6 KB → Task 1; §7 deploy VPS → Task 8; §8 tests → Tasks 1–4 + Task 7 smoke. ✅
- **Deviation from spec:** spec §2/§5 mention SSE streaming; this plan ships **non-streaming JSON** for v0 (structured-output gate is cleaner non-streaming; Haiku answers are short). Streaming is a post-MVP enhancement. Recorded here intentionally.
- **Type consistency:** `GateResult {covered, answer, citations}` defined in `grounding.ts`, used by `gate.ts`, `route.ts`, and the UI. `Lang = "vi" | "en"` consistent throughout. `COVERAGE_SCHEMA.required` = `["covered","citations","answer"]` matches `parseGateResult`.
- **Open risk:** `output_config` structured-output typing may lag in the installed SDK version — handled with a cast + note in Task 3 Step 3.
```
