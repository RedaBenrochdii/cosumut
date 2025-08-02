const fs = require('fs');
const path = require('path');

// Chemin du dossier contenant tous les fichiers bordereaux
const folderPath = path.join(__dirname, 'bordereaux');

// Initialisation du tableau global
let allDossiers = [];

// Lire tous les fichiers du dossier
fs.readdirSync(folderPath).forEach(file => {
  if (file.endsWith('.json')) {
    const filePath = path.join(folderPath, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Si le fichier contient un tableau "dossiers"
    if (content.dossiers && Array.isArray(content.dossiers)) {
      allDossiers = allDossiers.concat(content.dossiers);
    }
  }
});

// Sauvegarder dans un fichier fusionné
const outputPath = path.join(__dirname, 'data', 'dossiers.json');
fs.writeFileSync(outputPath, JSON.stringify(allDossiers, null, 2), 'utf8');

console.log(`✅ Fusion terminée. ${allDossiers.length} dossiers écrits dans data/dossiers.json`);
