# --- STAGE 1: Build ---
FROM node:24-slim AS builder
RUN corepack enable && corepack prepare pnpm@10.5.2 --activate
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
FROM node:24-slim
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/server.js ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
