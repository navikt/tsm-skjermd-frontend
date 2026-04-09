# --- STAGE 1: Build ---
FROM europe-north1-docker.pkg.dev/cgr-nav/pull-through/nav.no/node:latest-dev AS builder
USER root
RUN corepack enable && corepack prepare pnpm@10.5.2 --activate
USER node
WORKDIR /app

COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=secret,id=NODE_AUTH_TOKEN \
    sh -c 'echo "//npm.pkg.github.com/:_authToken=$(cat /run/secrets/NODE_AUTH_TOKEN)" >> .npmrc && pnpm install --frozen-lockfile && sed -i "/authToken/d" .npmrc'

COPY public ./public
COPY src ./src
COPY tsconfig*.json ./
COPY vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY server.js ./

RUN pnpm run build


# --- STAGE 2: Runtime ---
FROM europe-north1-docker.pkg.dev/cgr-nav/pull-through/nav.no/node:latest
WORKDIR /app

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/server.js ./
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/public ./public

EXPOSE 3000
CMD ["server.js"]
