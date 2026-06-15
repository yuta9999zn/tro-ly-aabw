# Deploy — Hostinger VPS (Docker, song song dự án cũ)

> **State thực tế của VPS `31.97.70.221`** (Ubuntu 24.04, KVM2 — 2 vCPU / 8GB / 100GB, ~73GB free):
> reverse proxy là **Caddy** (:80/:443), KHÔNG có nginx · app chạy bằng **Docker**, KHÔNG có pm2 / node-on-host.
> Đang chạy: `nb-web` (`127.0.0.1:3000`, dự án cũ) + `nb-postgres` (`5432`). **Tuyệt đối không đụng 2 container này.**
>
> Chế độ truy cập đã chốt: **IP:port trực tiếp** → `http://31.97.70.221:3100` (chưa domain/TLS).
> Port `3100` trống (đã verify không có trong `ss -ltnp`); `3000` đã bị `nb-web` chiếm.

## Các lệnh chạy trên VPS (SSH root@31.97.70.221)

```bash
# 0) Kiểm tra lại trước khi đụng gì (không thay đổi gì cả)
ss -ltnp | grep -E ':3100|:3000'   # 3100 phải TRỐNG; 3000 là nb-web — để yên
docker ps                          # nb-web + nb-postgres phải đang chạy

# 1) Lấy code
git clone https://github.com/yuta9999zn/tro-ly-aabw.git ~/tro-ly-aabw
cd ~/tro-ly-aabw

# 2) Đặt API key (KHÔNG commit, KHÔNG log). chmod 600.
cp .env.example .env.local
nano .env.local                    # dán ANTHROPIC_API_KEY=sk-ant-...
chmod 600 .env.local

# 3) Build + chạy container (publish 0.0.0.0:3100)
docker compose up -d --build

# 4) Verify — bot trả JSON covered:true + citations
sleep 5
docker compose ps                  # aabw-web = healthy
curl -s http://127.0.0.1:3100/api/chat \
  -H 'content-type: application/json' \
  -d '{"question":"Có những track nào?","lang":"vi"}'
# Kỳ vọng: {"covered":true, "citations":[...], "answer":"...", "disclosure":{...}}

# 5) Verify dự án cũ KHÔNG bị ảnh hưởng
docker ps                          # nb-web + nb-postgres vẫn Up
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/   # nb-web vẫn phản hồi
```

Truy cập public: **http://31.97.70.221:3100**

> ℹ️ Hostinger "Quy tắc tường lửa: 0" = không có rule chặn → port 3100 reachable từ ngoài.
> Nếu sau này bật cloud firewall, nhớ allow `3100/tcp`.

## Cập nhật KB sau khi deploy
Sửa `content/aabw-knowledge.md` (giữ mã `Fxx`) → push → trên VPS:
```bash
cd ~/tro-ly-aabw && git pull && docker compose up -d --build
```

## (Tùy chọn — sau này) Thêm domain + HTTPS qua Caddy
Khi có subdomain, thêm block vào `Caddyfile` đang dùng (KHÔNG sửa block của nb-web):
```caddy
aabw.<domain> {
    reverse_proxy 127.0.0.1:3100
}
```
Rồi đổi compose về `ports: ["127.0.0.1:3100:3000"]` (chỉ Caddy thấy) và `docker compose up -d`.
Reload Caddy: `docker exec <caddy-container> caddy reload --config /etc/caddy/Caddyfile` (hoặc `systemctl reload caddy` nếu chạy host). Caddy auto-cấp TLS Let's Encrypt.
