# Tuan Tanah backend — runs via tsx directly (no tsc build). tsx is a runtime
# dependency, so a --prod install keeps it while dropping dev-only tooling
# (typescript, vitest). Types are checked in CI via `pnpm check`, not here.
FROM node:20-alpine

RUN corepack enable

WORKDIR /app

# Workspace manifests first for better layer caching.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/

RUN pnpm install --frozen-lockfile --filter @tuan-tanah/server... --prod

# Source
COPY tsconfig.base.json ./
COPY shared ./shared
COPY server ./server

# Which commit this image came from. Unlike the client's, this one is only read
# at boot (bootstrap/env.ts), so it could have been a runtime variable — it is a
# build arg anyway so the two tiers report the same SHA for one `make deploy`,
# and so a container can never claim a build it wasn't made from.
ARG BUILD_SHA=""
ENV BUILD_SHA=$BUILD_SHA

ENV NODE_ENV=production
EXPOSE 3000

WORKDIR /app/server
CMD ["pnpm", "start"]
