# Trợ lý AABW — Grounded Support Bot (Thiết kế)

> **Ngày:** 2026-06-15 · **Dự án:** warm-up agent cho Agentic AI Build Week (AABW)
> **Deadline nộp:** ~20/06/2026 (track "Builder Experience Awards") · **Trạng thái:** spec đã duyệt, chờ kế hoạch triển khai

## 1. Mục tiêu & bối cảnh

AABW (Agentic AI Build Week, TP.HCM, 8–12/07/2026) có một track khởi động **Builder Experience Awards**: build công cụ/agent giúp chính builder của sự kiện. Cộng đồng vote; tool thắng được **deploy live cho hàng nghìn builder** trong tuần sự kiện. Cửa sổ nộp đóng khoảng **20/06** → chỉ còn ~5 ngày.

**Sản phẩm:** một web chat app công khai — *"Trợ lý AABW"* — trả lời câu hỏi về sự kiện (track, deadline, webinar, workshop, cách thi, link Discord/WhatsApp…) **dựa hoàn toàn trên dữ liệu chính thức**, và **từ chối khi không đủ dữ kiện thay vì bịa**.

**Điểm khác biệt (đi vote):** đây là port thu nhỏ của 2 nguyên tắc Kaori — grounding "học 1 hiểu 10 / decline-if-insufficient" (K-3) + machine-readable AI disclosure (K-24). Khẩu hiệu: *"Bot sự kiện duy nhất KHÔNG bịa."*

**Phi mục tiêu (YAGNI — cắt khỏi vòng warm-up):** pgvector / vector DB, đăng nhập, lưu lịch sử chat cross-session, multi-tenant. **Song ngữ VN + EN** (không thêm ngôn ngữ khác). Một corpus công khai + một model.

## 2. Kiến trúc — 4 mảnh, mỗi mảnh một việc

```
[Chat UI] --POST /api/chat--> [API route] --(KB cached + câu hỏi)--> [Claude Haiku 4.5]
   ^                                |                                       |
   |<-------- SSE stream -----------+<------ coverage gate + answer --------+
```

| Mảnh | Trách nhiệm | Công nghệ | Phụ thuộc |
|---|---|---|---|
| **Chat UI** (`app/page.tsx`) | Khung chat 1 trang; **toggle VN/EN**; stream câu trả lời; hiện badge disclosure + trích nguồn; trạng thái loading/lỗi | Next.js 16 (App Router) + Tailwind | gọi `/api/chat` |
| **API route** (`app/api/chat/route.ts`) | Nhận `{question}`; dựng request Claude (KB trong system, câu hỏi trong user turn); chạy grounding gate; trả SSE | Next.js Route Handler (Edge/Node runtime) + `@anthropic-ai/sdk` | `ANTHROPIC_API_KEY`, `lib/knowledge.ts`, `lib/grounding.ts` |
| **Knowledge base** (`lib/knowledge.ts` + `content/aabw-knowledge.md`) | Toàn bộ facts AABW chính thức, có cấu trúc + đánh số fact để cite | Markdown nhúng vào system prompt (prompt-cached) | — |
| **Grounding gate** (`lib/grounding.ts`) | Logic |OR| port: phán covered?/cite/decline | system-prompt rule + structured output | model |

### Boundaries (kiểm tra tính cô lập)
- **Chat UI** không biết gì về Claude — chỉ biết hợp đồng SSE của `/api/chat`. Đổi model/bên trong API không ảnh hưởng UI.
- **API route** không hardcode facts — đọc từ `lib/knowledge.ts`. Cập nhật sự kiện = sửa 1 file markdown.
- **Grounding gate** là hàm thuần nhận (câu hỏi, KB) → trả `{covered, answer, citations}` — test được độc lập, không cần UI.
- **Knowledge base** là dữ liệu thuần — không logic.

## 3. Grounding gate — port |OR| của Kaori (chi tiết)

Corpus nhỏ (vài KB) → **không cần retrieval/embeddings**. Toàn bộ KB nằm trong system prompt (prompt-cached để rẻ + nhanh). Cổng grounding thực thi ở tầng prompt + structured output:

**Bước 1 — Coverage gate (model tự phán):** request mang `lang ∈ {vi, en}` (theo toggle UI); model trả structured output
```json
{ "covered": true | false, "citations": ["F03", "F11"], "answer": "..." }
```
- `covered=true` → trả `answer` (đúng ngôn ngữ `lang`) kèm `citations` (mã fact trong KB). UI hiện "Nguồn: F03, F11".
- `covered=false` → **nhánh từ chối chuẩn**: *"Mình chưa có thông tin này trong dữ liệu AABW chính thức. Anh/chị hỏi trực tiếp ở Discord AABW (kênh #ask-clawbie) nhé."* + link. **Tuyệt đối không suy đoán.**

**Quy tắc system prompt (cứng):**
1. Chỉ trả lời từ KB được cung cấp. Không dùng kiến thức ngoài về AABW.
2. Mọi câu trả lời phải map được tới ≥1 mã fact; nếu không → `covered=false`.
3. Không chắc = `covered=false`. Thà từ chối còn hơn bịa (đây là tính năng, không phải lỗi).
4. Trả lời ngắn gọn theo ngôn ngữ `lang` (VN hoặc EN), giọng thân thiện. KB là tiếng Việt — khi `lang=en` thì dịch nội dung fact sang tiếng Anh, không thêm thông tin.

Đây chính là "decline-if-insufficient / học 1 hiểu 10" của Kaori (K-3), thu nhỏ cho corpus tĩnh.

## 4. Disclosure (port K-24)

Mỗi câu trả lời UI đính nhãn máy-đọc-được: `Tạo bởi AI · nguồn: AABW chính thức · model: claude-haiku-4-5`. Trả về trong payload SSE (`disclosure` field) + render badge.

## 5. Claude API (chốt theo skill claude-api)

- **Model:** `claude-haiku-4-5` (200K context, $1/$5 per 1M token — rẻ, nhanh, hợp public).
- **Streaming:** dùng `client.messages.stream()` + `.finalMessage()`; SSE xuống UI.
- **Structured output:** `output_config.format` (json_schema) cho coverage-gate shape `{covered, citations, answer}`. Haiku 4.5 hỗ trợ structured outputs.
- **Prompt caching:** KB + system rule đặt trước breakpoint `cache_control: ephemeral` (frozen, không nhét timestamp/UUID vào system) → mọi câu hỏi sau đọc cache (~0.1× giá).
- **max_tokens:** ~1024 (câu trả lời ngắn). KHÔNG để sampling param (`temperature`/`top_p`) — không cần, và để code tương thích model mới.
- **Key:** `ANTHROPIC_API_KEY` qua env (Vercel env var) — không hardcode.

## 6. Knowledge base v0 (rút từ email AABW)

`content/aabw-knowledge.md`, mỗi fact một mã `Fxx`:
- **Tracks** (Mobility/Tasco · Gaming/VNG · F&B/KFC · Retail/Phong Vũ · Aviation/Vietjet · Real Estate/Nova · Built with AWS) — mỗi track 60 slot, first-come.
- **Builder Experience Awards** — warm-up track, nộp ~20/06, công bố winner ở webinar 23/06.
- **Webinar briefing** — 23/06 14:00 giờ VN, có Zoom link qua đăng ký.
- **Discord + WhatsApp** — kênh ra thông báo + link workshop (KHÔNG gửi email). Discord có bot Clawbie.
- **Workshops** — 08/07 (BytePlus · NVIDIA Inception · TRAE) · 10/07 (Apify · Google Developers). Link sign-up ở kênh Discord `aabw-workshops`.
- **Event window** — 08–12/07, TP.HCM.
- **DevPost** — nơi lập team + nộp bài.

> Mọi fact phải truy được về email/site chính thức. Cái gì không có nguồn → không đưa vào KB (gate sẽ tự từ chối).

## 7. Triển khai (deploy) — Hostinger VPS

Đã chốt: deploy lên **Hostinger VPS** (anh đang có sẵn).
- **Server:** Ubuntu 24.04 LTS · KVM 2 (2 vCPU / ~8GB RAM) · IP `31.97.70.221` · root SSH.
- Node.js runtime đầy đủ → API key nằm an toàn server-side.
- **Khuyến nghị bảo mật:** tạo user `deploy` non-root + SSH key, `ufw` mở 22/80/443, chạy app dưới user đó thay vì root.

> **Cách thực thi deploy:** Kaori (agent này) **không SSH vào VPS**. Tới bước deploy, Kaori viết sẵn **một prompt copy-paste hoàn chỉnh để anh đưa cho "Claude edge"** (Claude có quyền SSH vào `31.97.70.221`) chạy: hardening (user `deploy` non-root + SSH key + `ufw`), cài Node LTS/PM2/nginx/certbot, clone + `npm ci` + build, set `ANTHROPIC_API_KEY` trong `.env` (chmod 600), `pm2 start` + `pm2 startup`, nginx reverse proxy + SSL. Prompt này là deliverable cuối của giai đoạn deploy.

Các bước (Ubuntu 24.04 — nội dung sẽ đóng gói thành prompt cho Claude edge):
1. Cài Node.js LTS (qua `nodesource` hoặc `nvm`) + `pm2` (`npm i -g pm2`). Cài `nginx` + `certbot` nếu chưa có (`apt install nginx certbot python3-certbot-nginx`).
2. Clone repo → `npm ci` → `npm run build` (`next build`).
3. Tạo `.env` trên server chứa `ANTHROPIC_API_KEY` (chmod 600, không commit, không xuống client).
4. `pm2 start "npm run start" --name tro-ly-aabw` (chạy `next start`, mặc định cổng 3000). `pm2 save` + `pm2 startup` để tự bật lại sau reboot.
5. **nginx reverse proxy**: subdomain (vd `aabw.<domain>`) → `proxy_pass http://127.0.0.1:3000`. Cấp SSL qua Let's Encrypt (`certbot`).
6. URL public (https) → dán vào DevPost + cho cộng đồng vote.

- **Cập nhật KB sát ngày:** sửa `content/aabw-knowledge.md` → `git pull` trên VPS → `npm run build` → `pm2 reload tro-ly-aabw`.
- **Vercel (dự phòng):** nếu VPS kẹt, `vercel deploy` + env `ANTHROPIC_API_KEY` là đường thoát nhanh.
- Rate-limit nhẹ ở API route (chống spam token) — giới hạn theo IP đơn giản (in-memory v0; nâng cấp sau nếu cần).

## 8. Test

- **Unit (grounding gate):** câu trong KB → `covered=true` + đúng citations; câu ngoài KB ("KFC có giảm giá gà rán không") → `covered=false`. Mock Claude response.
- **Smoke:** chạy thật 5 câu (3 trong KB, 2 ngoài) → kiểm không bịa.
- **UI:** gửi câu hỏi → thấy stream + badge disclosure + nguồn.

## 9. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| Thông tin AABW đổi sát ngày | KB là 1 file markdown — sửa nhanh, redeploy. Gate từ chối câu chưa có data thay vì sai. |
| Token bị lạm dụng (public) | Haiku rẻ + max_tokens nhỏ + rate-limit IP. Đặt budget alert. |
| Deadline 5 ngày | Scope cứng: 4 mảnh, không vector DB, chỉ VN. MVP chat+gate trước, polish sau. |
| Lộ API key | Env var only; key nằm server-side trong route handler, không xuống client. |

## 10. Thứ tự build (gợi ý cho kế hoạch)

1. Scaffold Next.js + Tailwind + `@anthropic-ai/sdk`.
2. `content/aabw-knowledge.md` + `lib/knowledge.ts` (load + cache string).
3. `lib/grounding.ts` (prompt + structured-output gate) + unit test.
4. `app/api/chat/route.ts` (SSE stream).
5. `app/page.tsx` (chat UI + badge).
6. Smoke test thật → deploy Vercel → lấy URL nộp DevPost.
