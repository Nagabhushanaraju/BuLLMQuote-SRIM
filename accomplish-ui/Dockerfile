FROM node:24-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY packages ./packages
COPY docs ./docs
COPY eslint.config.mjs ./

RUN pnpm install --config.engine-strict=false --config.confirmModulesPurge=false --prod=false

EXPOSE 5173
CMD ["pnpm", "dev:web", "--", "--host", "0.0.0.0"]
