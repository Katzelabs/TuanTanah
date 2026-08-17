# Web tier: build the React client, then serve it (and reverse-proxy the API)
# with an INTERNAL Caddy — it binds plain HTTP on :80 and never obtains a
# certificate; the platform edge terminates TLS in front of it (see Caddyfile).
# Build context must be the repo root
# (docker-compose sets context: . / dockerfile: client/Dockerfile) because the
# build copies workspace manifests and the shared package from the root.
FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json ./shared/
COPY client/package.json ./client/
RUN pnpm install --frozen-lockfile --filter @tuan-tanah/client...
COPY tsconfig.base.json ./
COPY shared ./shared
COPY client ./client
# VITE_SERVER_URL is intentionally left unset: in prod the client talks to the
# backend same-origin through Caddy, so the socket connects to its own host.
#
# VITE_PUBLIC_URL *is* environment-specific (it's baked into index.html for
# og:/twitter: share previews), so it arrives as a build arg — Vite reads env at
# build time, so a runtime `environment:` entry would never reach the bundle.
# This is also why prod and staging need separate image builds.
ARG VITE_PUBLIC_URL=""
ENV VITE_PUBLIC_URL=$VITE_PUBLIC_URL
RUN pnpm --filter @tuan-tanah/client build

FROM caddy:2-alpine
COPY --from=build /app/client/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
