# === Étape 1: Build ===
# Crée l'application React
FROM node:18-alpine AS build
WORKDIR /app
# Copier les fichiers de dépendances du frontend (package.json à la racine)
COPY package*.json ./
# Installer toutes les dépendances
RUN npm install
# Copier tout le code source du frontend
COPY . .
# Construire l'application pour la production
RUN npm run build
# === Étape 2: Serve ===
# Sert les fichiers statiques avec Nginx
FROM nginx:alpine
# Copier les fichiers statiques construits de l'étape précédente
COPY --from=build /app/dist /usr/share/nginx/html
# Copier la configuration Nginx pour gérer le routage des SPA (Single Page Application)
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Exposer le port 80 (port par défaut de Nginx)
EXPOSE 80
# La commande par défaut de Nginx s'exécutera