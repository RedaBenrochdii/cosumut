# syntax=docker/dockerfile:1

# ---- Build stage (compile native deps: better-sqlite3) ----
FROM node:20-bookworm-slim AS build
WORKDIR /usr/src/app

# Outils pour node-gyp
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ pkg-config \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# Utilise le lockfile si présent
RUN npm ci --no-audit --no-fund

# Copie du code
COPY . .
# Garde uniquement les deps de prod
RUN npm prune --omit=dev

# ---- Runtime stage (glibc stable) ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /usr/src/app
ENV NODE_ENV=production

# curl utile pour debug
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

# Copie deps + code
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app ./

# Dossiers requis par ton serveur
RUN mkdir -p data uploads bordereaux templates

EXPOSE 4000
# ⛔️ pas de healthcheck bloquant ici
CMD ["node", "server.js"]
