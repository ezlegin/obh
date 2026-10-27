# One image for both apps: web on 3000 and docs on 3200 (served publicly as
# https://obhco.ir/docs through the web app's /docs rewrite). Built by
# .github/workflows/deploy-image.yml and run by deploy/compose.yml. The whole
# workspace stays in the image so the same image also runs the Prisma schema
# push and the webhook worker (`docker compose run --rm web pnpm …`).
#
# The build never touches a live database: prisma generate only needs a
# well-formed URL and the admin pages render per request.
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

COPY . .
# `postinstall` runs `prisma generate`, which needs a parseable URL only.
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:1/none" \
    pnpm install --frozen-lockfile

# Public URLs are inlined into the build; the domain is fixed.
ENV APP_URL="https://obhco.ir" \
    NEXT_PUBLIC_APP_URL="https://obhco.ir" \
    NEXT_PUBLIC_DOCS_URL="https://obhco.ir/docs" \
    DOCS_INTERNAL_URL="http://docs:3200"
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:1/none" pnpm --filter docs build \
 && DATABASE_URL="postgresql://build:build@127.0.0.1:1/none" pnpm --filter web build \
 && rm -rf apps/web/.next/cache apps/docs/.next/cache

FROM node:22-bookworm-slim
WORKDIR /app
ARG APP_VERSION=dev
ARG APP_BUILT_AT=
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    APP_VERSION=$APP_VERSION \
    APP_BUILT_AT=$APP_BUILT_AT
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
COPY --from=build --chown=node:node /app /app
# The private document volume is initialised from this directory; it must be
# writable by the runtime user.
RUN mkdir -p /app/storage/expense-documents && chown -R node:node /app/storage
USER node
EXPOSE 3000 3200
CMD ["pnpm", "--filter", "web", "start"]
