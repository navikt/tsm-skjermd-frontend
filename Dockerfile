# --- STAGE 1: Build ---
FROM node:24-slim AS builder
WORKDIR /app

# Mount the secret NODE_AUTH_TOKEN for authentication
COPY package*.json ./
RUN --mount=type=secret,id=NODE_AUTH_TOKEN \
    sh -c 'echo "//npm.pkg.github.com/:_authToken=$(cat /run/secrets/NODE_AUTH_TOKEN)" > .npmrc && npm ci && rm .npmrc'
RUN npm config set @navikt:registry=https://npm.pkg.github.com

COPY public ./public
COPY src ./src
COPY tsconfig*.json ./
COPY vite.config.ts tailwind.config.js postcss.config.js index.html iframe.html ./
COPY server.js ./

RUN npm run build


# --- STAGE 2: Runtime ---
FROM node:24-slim
WORKDIR /app

# Copy files from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server.js ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["npm", "start"]
