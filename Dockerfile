# syntax=docker/dockerfile:1
# Loadder Docker D1 - LOCAL DEVELOPMENT ONLY. One Debian/glibc Node 22 image serves the
# API supervisor (server/start.mjs) and the Vite dev server. Dependencies are installed
# inside Linux (better-sqlite3 is native); host node_modules never enter the image.
# Throw-away stage: `npm ci` runs an implicit `node-gyp rebuild` for better-sqlite3, which needs a
# toolchain. Only node_modules reach the image below; at runtime better-sqlite3 loads its bundled
# Linux prebuild. (`npm ci --ignore-scripts` for server/ would likely remove the need for this stage.)
FROM node:22-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY server/package.json server/package-lock.json server/
RUN npm ci --prefix server --no-audit --no-fund

FROM node:22-bookworm-slim AS dev
WORKDIR /app
# /data is the only writable runtime location. Creating it here, owned by `node`, makes a new
# named volume inherit that ownership.
RUN mkdir -p /app /data && chown node:node /app /data
USER node
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=deps --chown=node:node /app/server/node_modules ./server/node_modules
COPY --chown=node:node . .
VOLUME ["/data"]

# Browser verification: same base (same Node ABI for better-sqlite3), Chromium pinned by
# the lockfile's @playwright/test version, ffmpeg for the Education video fixture, socat so
# the browser sees the same localhost origins as a developer's host browser.
FROM dev AS e2e
USER root
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install --with-deps chromium \
 && apt-get install -y --no-install-recommends ffmpeg socat curl \
 && rm -rf /var/lib/apt/lists/* \
 && chmod -R a+rX /ms-playwright
USER node
