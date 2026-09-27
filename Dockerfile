# syntax=docker/dockerfile:1

# --------------------------------------------------
# 1. Wspólna baza Node.js
# --------------------------------------------------
FROM node:24-bookworm-slim AS base

WORKDIR /app

ENV NODE_ENV=production

# --------------------------------------------------
# 2. Zależności aplikacji i narzędzia buildowe
# --------------------------------------------------
FROM base AS dependencies

ENV NODE_ENV=development

# pyftsubset pochodzi z pakietu fonttools.
# Instalujemy go tylko w warstwie potrzebnej do buildu.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
  && python3 -m pip install \
    --no-cache-dir \
    --break-system-packages \
    fonttools \
    brotli \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY scripts/check-node-version.js ./scripts/check-node-version.js

RUN npm ci

# --------------------------------------------------
# 3. Build aplikacji Astro
# --------------------------------------------------
FROM dependencies AS build

ARG SITE_URL
ARG PUBLIC_SITE_ENV

ENV SITE_URL=${SITE_URL}
ENV PUBLIC_SITE_ENV=${PUBLIC_SITE_ENV}

COPY . .

RUN npm run build

RUN npm prune --omit=dev

# --------------------------------------------------
# 4. Jednorazowe narzędzia produkcyjne
# --------------------------------------------------
FROM dependencies AS migrate

ENV NODE_ENV=production

COPY . .

CMD ["npm", "run", "db:migrate"]

FROM migrate AS bootstrap

CMD ["npm", "run", "db:bootstrap:production"]

# --------------------------------------------------
# 5. Minimalny obraz produkcyjny
# --------------------------------------------------
FROM base AS runtime

ENV HOST=0.0.0.0
ENV PORT=4321
ENV MEDIA_UPLOAD_DIR=/data/media

RUN mkdir -p /data/media && chown node:node /data/media

USER node

COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

EXPOSE 4321

CMD ["node", "./dist/server/entry.mjs"]
