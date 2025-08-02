const express = require('express');
const fs = require('fs-extra');
const path = require('path');

const router = express.Router();

// 📁 Chemin absolu pour history.json
const isPkg = typeof process.pkg !== 'undefined';
const baseDir = isPkg ? path.dirname(process.execPath) : __dirname;
const HISTORY_FILE = path.join(baseDir, 'history.json');

// ✅ Ajout d’un document dans l’historique
router.post('/api/history/add', async (req, res) => {
  try {
    const { filename, data } = req.body;
    if (!filename || !data) {
      return res.status(400).json({ success: false, message: 'Champs requis manquants' });
    }

    const history = fs.existsSync(HISTORY_FILE)
      ? await fs.readJson(HISTORY_FILE)
      : [];

    history.push({ filename, data });
    await fs.writeJson(HISTORY_FILE, history, { spaces: 2 });

    res.status(200).json({ success: true, message: '✅ Document ajouté à l’historique' });
  } catch (error) {
    console.error('Erreur ajout historique :', error);
    res.status(500).json({ success: false, message: 'Erreur lors de l’ajout à l’historique' });
  }
});

module.exports = router;
