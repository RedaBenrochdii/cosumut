
# Étape 1: Utiliser une image Node.js officielle et légère
FROM node:18-alpine AS base

# Définir le répertoire de travail dans le conteneur
WORKDIR /usr/src/app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer uniquement les dépendances de production
RUN npm install --production

# Copier le reste des fichiers de l'application
COPY . .

# Exposer le port sur lequel le serveur écoute
EXPOSE 4000

# Commande pour démarrer le serveur
CMD [ "node", "server.js" ]
