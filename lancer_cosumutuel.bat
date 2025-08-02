@echo off
title Démarrage de Cosumutuel

echo 🔄 Démarrage du backend...
start cmd /k "cd /d %~dp0backend && npm run dev"

timeout /t 2 >nul

echo 🧠 Démarrage du frontend...
start cmd /k "cd /d %~dp0 && npm run dev"

timeout /t 3 >nul

echo 🌐 Ouverture du navigateur sur http://localhost:5173
start http://localhost:5173

exit
