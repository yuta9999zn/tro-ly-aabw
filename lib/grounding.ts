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
