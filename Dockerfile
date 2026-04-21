# syntax=docker/dockerfile:1.7
#
# In the monorepo, this Dockerfile is invoked from the repo root
# (Railway's default build context), so COPY paths are prefixed with
# ``. The sync-oss-dashboard.sh script strips that prefix when
# publishing to the public netwatch-dashboard repo, where the whole
# repo is the equivalent of `` and the build context is flat.

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat python3 make g++
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NETWATCH_DASHBOARD_DATA_DIR=/data

RUN apk add --no-cache libstdc++ \
    && addgroup -g 1001 -S nodejs \
    && adduser -u 1001 -S nextjs -G nodejs \
    && mkdir -p /data \
    && chown -R nextjs:nodejs /data

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# better-sqlite3 native binary isn't always picked up by standalone output tracing
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bindings ./node_modules/bindings
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path

USER nextjs
EXPOSE 3000

# /data is where SQLite + config live in standalone mode. Mount a volume
# there at runtime (`docker run -v netwatch-data:/data ...`). VOLUME is
# intentionally NOT declared — Railway rejects Dockerfiles that use it
# and expects platform-native volume mounts instead.

CMD ["node", "server.js"]
