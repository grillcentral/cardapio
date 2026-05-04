# ═════════ Stage 1: Build ═════════
FROM node:20-alpine AS builder

WORKDIR /app

# Dependências do Prisma
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

COPY tsconfig.json ./
COPY src ./src/

RUN npx prisma generate
RUN npm run build

# ═════════ Stage 2: Produção ═════════
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache openssl tini

# Usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production && npm cache clean --force
RUN npx prisma generate

COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

USER nodejs

EXPOSE 3333

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
