"use client";
import { useState } from "react";

type Lang = "vi" | "en";
interface Msg {
  role: "user" | "bot";
  text: string;
  citations?: string[];
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
    limited: "Bạn gửi hơi nhanh, chờ chút rồi thử lại nhé.",
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
    limited: "You're sending too fast, please wait a moment.",
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
      if (res.status === 429) {
        setMsgs((m) => [...m, { role: "bot", text: t.limited }]);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "error");
      setMsgs((m) => [...m, { role: "bot", text: data.answer, citations: data.citations }]);
    } catch {
      setMsgs((m) => [...m, { role: "bot", text: t.error }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex h-screen w-full max-w-2xl flex-col p-4">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t.title}</h1>
          <p className="text-sm text-gray-500">{t.tagline}</p>
        </div>
        <button
          onClick={() => setLang(lang === "vi" ? "en" : "vi")}
          className="rounded border px-2 py-1 text-sm"
          aria-label="toggle language"
        >
          {lang === "vi" ? "EN" : "VI"}
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto rounded border p-3">
        {msgs.length === 0 && <p className="text-sm text-gray-400">{t.placeholder}</p>}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <div
              className={
                "inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm " +
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
        <button
          onClick={send}
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {t.send}
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-gray-400">{t.disclosure}</p>
    </main>
  );
}
