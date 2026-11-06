# syntax=docker/dockerfile:1.7
#
# Imagen de la app web (Next.js).
#   target "dev"  → desarrollo: el código se monta como volumen y se recarga en caliente.
#   target "prod" → producción local (./start.sh --prod): build "standalone" y usuario sin privilegios.
# El host solo necesita Docker: Node y pnpm viven acá adentro.

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-bookworm-slim AS base
ARG PNPM_VERSION=12.16.1
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install -g pnpm@${PNPM_VERSION} && npm cache clean --force
WORKDIR /app

# ------------------------------------------------------------------------------------------------
FROM base AS dev
ENV NODE_ENV=development
EXPOSE 3000
# Corre como el usuario del host (compose pasa `user:`), así los archivos generados no quedan de root.
CMD ["sh", "-c", "mkdir -p \"$HOME\" && CI=true pnpm install --frozen-lockfile=false && exec pnpm --filter @trafal/web dev --hostname 0.0.0.0 --port 3000"]

# ------------------------------------------------------------------------------------------------
# Compilación (solo para el target "prod"). Las variables NEXT_PUBLIC_* se incrustan en el JS del
# navegador al compilar, por eso entran como argumentos de build.
FROM base AS build
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false
ARG NEXT_PUBLIC_MEDIA_URL
ARG NEXT_PUBLIC_GAMES_BASE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=$NEXT_PUBLIC_GOOGLE_AUTH_ENABLED \
    NEXT_PUBLIC_MEDIA_URL=$NEXT_PUBLIC_MEDIA_URL \
    NEXT_PUBLIC_GAMES_BASE_URL=$NEXT_PUBLIC_GAMES_BASE_URL \
    CI=true
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile
COPY apps/web apps/web
WORKDIR /app/apps/web
RUN pnpm build

# ------------------------------------------------------------------------------------------------
# Imagen final: solo el servidor standalone, con un usuario sin privilegios.
FROM node:${NODE_VERSION}-bookworm-slim AS prod
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
RUN groupadd --system --gid 1001 app && useradd --system --uid 1001 --gid app --no-create-home app
COPY --from=build --chown=app:app /app/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=app:app /app/apps/web/public ./apps/web/public
USER app
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
