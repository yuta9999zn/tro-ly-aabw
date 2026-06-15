# syntax=docker/dockerfile:1

# ---- deps: install all deps (incl. dev) for the build ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: produce the Next.js standalone output ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build does NOT need ANTHROPIC_API_KEY (the key is read per-request at runtime).
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runner: minimal runtime image ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as a non-root user.
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# Standalone server + static assets + public dir.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# The KB is read at runtime via process.cwd()/content/aabw-knowledge.md
# (lib/knowledge.ts) — standalone output does NOT include it automatically.
COPY --from=builder /app/content ./content

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
