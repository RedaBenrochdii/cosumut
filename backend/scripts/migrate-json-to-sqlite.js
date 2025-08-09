// scripts/migrate-json-to-sqlite.js
require('dotenv').config();
process.env.STORAGE_DRIVER = 'sqlite';
process.env.DB_PATH = process.env.DB_PATH || './data/cosumutuel.db';

const path = require('path');
const fs = require('fs-extra');
const storage = require('../services/storage');

(async () => {
  const EMP_JSON = path.join(__dirname, '../data/employes.json');
  if (!fs.existsSync(EMP_JSON)) {
    console.log('Aucun employes.json trouvé, fin.');
    return;
  }
  const list = await fs.readJson(EMP_JSON);
  let n = 0;
  for (const e of list) {
    await storage.employes.upsert(e);
    if (Array.isArray(e.Famille)) {
      for (const m of e.Famille) {
        await storage.famille.add(e.Matricule_Employe, m);
      }
    }
    n++;
  }
  console.log(`✅ Migration terminée : ${n} employés importés dans SQLite.`);
})();
