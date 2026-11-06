# syntax=docker/dockerfile:1.7
#
# Games gateway image: serves each published game from <public_id>.<games domain> with strict security headers.
# Node runs the TypeScript sources directly (type stripping), so there is no build step.

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-bookworm-slim AS deps
ARG PNPM_VERSION=12.16.1
RUN npm install -g pnpm@${PNPM_VERSION} && npm cache clean --force
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/gateway/package.json apps/gateway/package.json
RUN CI=true pnpm install --frozen-lockfile --prod --filter @trafal/gateway

FROM node:${NODE_VERSION}-bookworm-slim AS run
ENV NODE_ENV=production PORT=4000
WORKDIR /app/apps/gateway
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/apps/gateway/node_modules ./node_modules
COPY apps/gateway/package.json ./package.json
COPY apps/gateway/src ./src
USER node
EXPOSE 4000
CMD ["node", "src/server.ts"]
