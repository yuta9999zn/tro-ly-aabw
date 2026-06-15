import Anthropic from "@anthropic-ai/sdk";
import { runGate } from "@/lib/gate";
import { allow } from "@/lib/ratelimit";
import { checkBefore, recordAnswer } from "@/lib/spam";
import { DISCLOSURE, offTopicNudge, repeatPrefix, type Lang } from "@/lib/grounding";

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

  // Spam guard (before spending Claude tokens).
  const spam = checkBefore(ip, question);
  if (spam.offTopicBlocked) {
    return Response.json({
      covered: false,
      answer: offTopicNudge(lang),
      citations: [],
      flagged: "off_topic",
      disclosure: DISCLOSURE,
    });
  }
  if (spam.repeat && spam.lastAnswer) {
    return Response.json({
      covered: true,
      answer: repeatPrefix(lang) + spam.lastAnswer,
      citations: [],
      flagged: "repeat",
      disclosure: DISCLOSURE,
    });
  }

  try {
    const result = await runGate(question, lang, client);
    recordAnswer(ip, question, result.covered, result.answer);
    return Response.json({ ...result, disclosure: DISCLOSURE });
  } catch (e) {
    console.error("gate error", e);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
