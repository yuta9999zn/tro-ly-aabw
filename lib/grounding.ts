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

/** Nudge shown when an IP floods the bot with off-topic questions. */
export function offTopicNudge(lang: Lang): string {
  return lang === "vi"
    ? "Bạn đang hỏi nhiều câu ngoài chủ đề AABW. Mình chỉ trả lời về Agentic AI Build Week thôi nhé — thử hỏi về track, deadline hoặc workshop xem."
    : "You're asking several questions outside the AABW topic. I only answer about Agentic AI Build Week — try asking about tracks, deadlines, or workshops.";
}

/** Prefix prepended when re-serving a cached answer to a repeated question. */
export function repeatPrefix(lang: Lang): string {
  return lang === "vi"
    ? "Bạn vừa hỏi câu tương tự rồi nhé — mình nhắc lại:\n"
    : "You just asked a similar question — here it is again:\n";
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
    "1. Chỉ dùng thông tin trong KNOWLEDGE BASE bên dưới. Không thêm thông tin ngoài KB.",
    "2. Nếu KB CÓ thông tin trả lời được câu hỏi (trực tiếp, hoặc suy ra hợp lý từ một fact) → covered=true. Trả lời dựa đúng fact đó và liệt kê mã Fxx vào citations. Hãy trả lời tự tin khi fact tồn tại — đừng từ chối câu mà KB rõ ràng có đáp án.",
    "3. Chỉ covered=false khi KB HOÀN TOÀN không có thông tin liên quan tới câu hỏi. Khi đó answer để chuỗi rỗng, citations rỗng (hệ thống sẽ tự chèn câu từ chối).",
    "4. Tuyệt đối không bịa thông tin không có trong KB. Không suy đoán ngoài phạm vi các fact.",
    `5. ${langRule}`,
    "6. Trả về JSON: covered (bool), citations (mảng mã Fxx đã dùng), answer (chuỗi).",
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
