# Trợ lý AABW

Grounded support bot cho **Agentic AI Build Week**. Trả lời câu hỏi về sự kiện **chỉ dựa trên** `content/aabw-knowledge.md`; **từ chối (không bịa)** khi câu hỏi không có trong dữ liệu. Song ngữ **VN + EN**.

Port thu nhỏ 2 nguyên tắc của Kaori: grounding "decline-if-insufficient" (K-3) + AI disclosure máy-đọc-được (K-24). Có spam guard (chặn câu lặp/tương đương + flood câu ngoài chủ đề, tiết kiệm token).

## Stack
Next.js 16 (App Router) + TypeScript + Tailwind · `@anthropic-ai/sdk` (`claude-haiku-4-5`, structured output) · Vitest.

## Dev
1. `npm ci`
2. Tạo `.env.local` với `ANTHROPIC_API_KEY=sk-ant-...`
3. `npm run dev` → http://localhost:3000

## Test
`npm test` (unit, dùng mock — không cần API key)

## Cập nhật knowledge base
Sửa `content/aabw-knowledge.md` (giữ các mã `Fxx`), rồi rebuild + restart (KB được cache trong process):
```
git pull && npm run build && pm2 reload tro-ly-aabw
```

## Deploy
Hostinger VPS — xem `DEPLOY_PROMPT.md` (prompt copy-paste cho agent có SSH, deploy SONG SONG không đụng dự án cũ trên VPS).

## Kiến trúc
- `content/aabw-knowledge.md` — facts chính thức, mã `Fxx`.
- `lib/knowledge.ts` — load KB.
- `lib/grounding.ts` — system prompt + coverage-gate schema + parse + decline/nudge messages + disclosure.
- `lib/gate.ts` — gọi Claude với structured output `{covered, citations, answer}`.
- `lib/ratelimit.ts` — rate limit per-IP.
- `lib/spam.ts` — chặn câu lặp/tương đương + flood ngoài chủ đề.
- `app/api/chat/route.ts` — POST: rate-limit → spam guard → gate → JSON.
- `app/page.tsx` — chat UI VN/EN, citations, disclosure badge.
