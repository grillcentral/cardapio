ARG NODE_VERSION=24.14.1-slim

# ── Stage 1: Install dependencies (including native module compilation) ──
FROM node:${NODE_VERSION} AS dependencies
WORKDIR /app

# Build tools needed for better-sqlite3 native module
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# ── Stage 2: Build Next.js ──
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder

RUN node_modules/.bin/prisma generate

RUN npm run build

# ── Stage 3: Production runner ──
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1
ENV DB_PATH=/data/lanche.db

# Copy build output and assets
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/next.config.ts ./
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/prisma.config.ts ./
COPY --from=builder --chown=node:node /app/scripts ./scripts

# Install OpenSSL required by Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Persistent data directory for SQLite and uploads
RUN mkdir -p /data && chown node:node /data
RUN mkdir -p /app/public/uploads && chown node:node /app/public/uploads
RUN chmod +x /app/scripts/start.sh

USER node

EXPOSE 3000

CMD ["/bin/sh", "/app/scripts/start.sh"]
