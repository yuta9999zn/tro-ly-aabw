# Deploy prompt — dán cho Claude edge (agent có SSH tới VPS)

Sao chép nguyên khối dưới đây, điền các placeholder `<...>`, rồi đưa cho agent có quyền SSH vào VPS chạy. Người viết app (Kaori) KHÔNG tự SSH.

---

You have SSH root access to a Hostinger VPS (Ubuntu 24.04 LTS, KVM2) at 31.97.70.221.
**This VPS ALREADY RUNS another production project. Deploy "Trợ lý AABW" ALONGSIDE it WITHOUT
disrupting the existing app.** Do all of this:

0. INVENTORY FIRST (do not change anything yet). Record and report:
   - `ss -ltnp` (ports in use — the existing app's port must stay untouched)
   - `pm2 list` (existing PM2 processes — do NOT stop/restart/delete any of them)
   - `ls /etc/nginx/sites-enabled/` and read existing server blocks (do NOT edit them)
   - `ufw status` (is the firewall active? which ports already allowed?)
   - `node -v` and whether Node is managed by nvm
   Pick a FREE internal port for this app (e.g. 3100) — verify it is not in `ss -ltnp`.
1. Harden: create a non-root user `deploy` with sudo, copy the authorized SSH key to it, run the
   app as `deploy` (not root). ufw: if INACTIVE, do NOT enable it blindly (could cut the existing
   app) — only enable after explicitly allowing 22/80/443 AND every port the existing app needs; if
   ACTIVE, just ensure 22/80/443 are allowed. When unsure, leave ufw as-is and report.
2. Install Node.js LTS for the `deploy` user via **nvm** (do NOT change the system/global Node the
   existing app may rely on). `npm i -g pm2` is fine (pm2 runs many apps independently). nginx +
   certbot are likely already installed (the other app uses them) — `apt install -y` only if missing.
3. As `deploy`: `git clone <REPO_URL> ~/tro-ly-aabw && cd ~/tro-ly-aabw && npm ci && npm run build`.
4. Create `~/tro-ly-aabw/.env.local` with `ANTHROPIC_API_KEY=<KEY>` (chmod 600). Never log the key.
5. Start on the dedicated port: `PORT=3100 pm2 start "npm run start" --name tro-ly-aabw`
   (Next.js `next start` honors PORT). `pm2 save`. Run `pm2 startup` ONLY if pm2 isn't already set
   to start on boot (check first — the existing app likely configured it already).
6. nginx: ADD A NEW server block file (e.g. `/etc/nginx/sites-available/tro-ly-aabw`) for <SUBDOMAIN>
   → `proxy_pass http://127.0.0.1:3100;` with proxy headers. Symlink into sites-enabled.
   **Do NOT modify the existing app's server block.** `nginx -t && systemctl reload nginx`
   (reload, not restart — reload doesn't drop the existing app's connections).
7. SSL: `certbot --nginx -d <SUBDOMAIN>` (HTTPS + auto-renew) — scope to the new subdomain only.
8. Verify, and confirm the existing app still responds on its own domain/port:
   `curl -s https://<SUBDOMAIN>/api/chat -H 'content-type: application/json' -d '{"question":"Có những track nào?","lang":"vi"}'`
   should return JSON with `covered:true` and citations.

Report: the step-0 inventory, the final public URL, and confirmation the existing project is
unaffected. Placeholders to fill: <REPO_URL>, <KEY>, <SUBDOMAIN>, authorized SSH key.

---

## Cập nhật KB sau khi deploy
Sửa `content/aabw-knowledge.md` → trên VPS (user `deploy`): `cd ~/tro-ly-aabw && git pull && npm run build && pm2 reload tro-ly-aabw`.
