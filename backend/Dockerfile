# backend/Dockerfile
FROM node:20-bookworm-slim

WORKDIR /usr/src/app

# Installation des outils nécessaires pour better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ pkg-config curl \
    && rm -rf /var/lib/apt/lists/*

# Copier package.json
COPY package*.json ./

# Installer toutes les dépendances
RUN npm ci --no-audit --no-fund

# Copier le code source
COPY . .

# Créer les dossiers nécessaires
RUN mkdir -p data uploads bordereaux templates

# Variables d'environnement
ENV NODE_ENV=production

EXPOSE 4000

CMD ["node", "server.js"]
