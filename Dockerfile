# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm if [ -f package-lock.json ]; then npm ci; else npm install; fi

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV DATABASE_URL=mysql://build:build@localhost:3306/build
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build \
    && npm prune --omit=dev --no-audit --no-fund \
    && npx prisma generate

FROM node:22-bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 1001 plandan
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder --chown=plandan:plandan /app/package.json ./package.json
COPY --from=builder --chown=plandan:plandan /app/node_modules ./node_modules
COPY --from=builder --chown=plandan:plandan /app/.next ./.next
COPY --from=builder --chown=plandan:plandan /app/public ./public
COPY --from=builder --chown=plandan:plandan /app/prisma ./prisma
COPY --from=builder --chown=plandan:plandan /app/worker ./worker
COPY --from=builder --chown=plandan:plandan /app/next.config.mjs ./next.config.mjs
USER plandan
EXPOSE 3600
CMD ["npm","run","start"]
