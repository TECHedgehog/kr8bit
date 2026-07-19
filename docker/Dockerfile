# syntax=docker/dockerfile:1.7

# ---- Stage 1: web build ----
FROM node:20-slim AS web-builder
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/tsconfig.json web/vite.config.ts web/index.html ./
COPY web/src ./src
RUN npm run build

# ---- Stage 2: server build ----
FROM node:20-slim AS server-builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate
RUN npm run build

# ---- Stage 3: runtime ----
FROM node:20-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    p7zip-full ca-certificates tini wget \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
ENV DB_PATH=/data/kr8bit.db
ENV CACHE_DIR=/data/cache
ENV LIBRARY_ROOT=/games
ENV DATABASE_URL=file:/data/kr8bit.db

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=server-builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=server-builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=server-builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=server-builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=server-builder /app/dist ./dist
COPY --from=server-builder /app/prisma ./prisma
COPY --from=web-builder /web/dist ./web/dist
COPY docker/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

RUN useradd -r -u 1000 -g users kr8bit \
  && mkdir -p /data /games \
  && chown -R kr8bit:users /app /data /games

USER kr8bit
VOLUME ["/data", "/games"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:8080/api/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["./docker-entrypoint.sh"]