// 🔐 .env
require('dotenv').config();
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ Clé Gemini manquante dans .env");
  process.exit(1);
}

const storage = require('./services/storage');
// 🌐 Dépendances
const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const XLSX = require('xlsx');
const uploadRoute = require('./routes/uploadRoute'); // Assurez-vous que ce chemin est correct
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const bcrypt = require('bcrypt');
const USERS_FILE = path.join(__dirname, 'data', 'users.json'); // Chemin vers votre nouveau fichier

// 📁 Chemins
const isPkg = typeof process.pkg !== 'undefined';
const baseDir = isPkg ? path.dirname(process.execPath) : __dirname;

// ✅ Initialisation serveur
const app = express();
const PORT = 4000;

// ✅ Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', uploadRoute);

// 📁 Dossiers
const EMPLOYES_FILE = path.join(__dirname, 'data', 'employes.json');
const DATA_FILE = path.join(__dirname, 'documents.json');
const uploadDir = path.join(__dirname, 'uploads');
const bordereauxDir = path.join(__dirname, 'bordereaux');
const bordereauxHistoryFile = path.join(__dirname, 'data', 'bordereaux.json');
fs.ensureDirSync(uploadDir);
fs.ensureDirSync(bordereauxDir);
app.use('/uploads', express.static(uploadDir));
app.use('/bordereaux', express.static(bordereauxDir));

// ▼▼▼ ROUTE DE CONNEXION MISE À JOUR AVEC BCRYPT ▼▼▼
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  try {
    const users = fs.readJsonSync(USERS_FILE);
    const user = users.find(u => u.username === username);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Identifiants invalides' });
    }

    // On compare le mot de passe fourni avec le hash stocké
    bcrypt.compare(password, user.password_hash, (err, isMatch) => {
      if (err || !isMatch) {
        return res.status(401).json({ success: false, message: 'Identifiants invalides' });
      }

      // La connexion est réussie
      // Dans une application réelle, générez ici un JWT
      res.json({ success: true, token: 'unVraiTokenJWT', role: user.role });
    });

  } catch (error) {
    console.error("Erreur lors de la lecture du fichier utilisateurs :", error);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

// 📋 Employés
app.get('/api/employes', (_, res) => {
  try {
    const data = fs.readJsonSync(EMPLOYES_FILE);
    res.json(data);
  } catch (err) {
    console.error("Erreur lecture employés:", err);
    res.status(500).json({ error: 'Erreur lecture employés' });
  }
});

app.post('/api/employes/add', (req, res) => {
  try {
    const newEmp = req.body;
    const data = fs.existsSync(EMPLOYES_FILE) ? fs.readJsonSync(EMPLOYES_FILE) : [];
    if (data.some(e => e.Matricule_Employe === newEmp.Matricule_Employe)) {
      return res.status(409).json({ success: false, error: 'Employé déjà existant' });
    }
    data.push(newEmp);
    fs.writeFileSync(EMPLOYES_FILE, JSON.stringify(data, null, 2), 'utf-8');
    res.json({ success: true, message: 'Employé ajouté', employe: newEmp });
  } catch (err) {
    console.error("Erreur ajout employé:", err);
    res.status(500).json({ error: 'Erreur ajout employé', details: err.message });
  }
});

app.post('/api/employes/:matricule/famille/add', (req, res) => {
  const { matricule } = req.params;
  const newMember = req.body;
  try {
    const data = fs.readJsonSync(EMPLOYES_FILE);
    const emp = data.find(e => e.Matricule_Employe === matricule);
    if (!emp) return res.status(404).json({ error: 'Employé introuvable' });
    emp.Famille = emp.Famille || [];
    emp.Famille.push(newMember);
    fs.writeFileSync(EMPLOYES_FILE, JSON.stringify(data, null, 2), 'utf-8');
    res.json({ success: true, message: 'Membre famille ajouté' });
  } catch (err) {
    console.error("Erreur ajout membre famille:", err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

app.get('/api/employes/:matricule', (req, res) => {
  const { matricule } = req.params;
  try {
    const data = fs.readJsonSync(EMPLOYES_FILE);
    const emp = data.find(e => e.Matricule_Employe === matricule);
    if (!emp) return res.status(404).json({ error: 'Employé introuvable' });
    res.json(emp);
  } catch (err) {
    console.error("Erreur récupération employé:", err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/api/employes/:matricule/conjoint', (req, res) => {
  const { matricule } = req.params;
  try {
    const data = fs.readJsonSync(EMPLOYES_FILE);
    const emp = data.find(e => e.Matricule_Employe === matricule);
    const conjoint = emp?.Famille?.find(f => f.type === 'conjoint');
    if (conjoint) {
      res.json({ Nom_Conjoint: emp.Nom_Employe, Prenom_Conjoint: conjoint.prenom });
    } else {
      res.status(404).json({ error: 'Aucun conjoint trouvé' });
    }
  } catch (err) {
    console.error("Erreur récupération conjoint:", err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/api/employes/:matricule/enfants', (req, res) => {
  const { matricule } = req.params;
  try {
    const data = fs.readJsonSync(EMPLOYES_FILE);
    const emp = data.find(e => e.Matricule_Employe === matricule);
    const enfants = emp?.Famille?.filter(f => f.type === 'enfant') || [];
    res.json(enfants.map(e => ({ Nom_Enfant: emp.Nom_Employe, Prenom_Enfant: e.prenom, DateNaissance: e.DateNaissance })));
  } catch (err) {
    console.error("Erreur récupération enfants:", err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// 📥 Upload fichiers
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

app.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    const doc = {
      filename: req.file.filename,
      commentaire: req.body.commentaire,
      date: new Date().toISOString()
    };
    const oldData = fs.existsSync(DATA_FILE) ? await fs.readJson(DATA_FILE) : [];
    oldData.push(doc);
    await fs.writeJson(DATA_FILE, oldData, { spaces: 2 });
    res.json({ success: true, message: 'Document reçu' });
  } catch (err) {
    console.error("Erreur upload document:", err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.get('/documents', async (_, res) => {
  try {
    const data = await fs.readJson(DATA_FILE);
    res.json(data);
  } catch (err) {
    console.error("Erreur lecture documents:", err);
    res.json([]);
  }
});

// 🤖 Gemini OCR - MISE À JOUR POUR LES NOUVEAUX NOMS DE CHAMPS
app.post('/api/ocr/gemini', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier reçu.' });
    }

    // PROMPT MIS À JOUR POUR CORRESPONDRE AUX CHAMPS DU FORMULAIRE REACT
    const prompt = `
      Analyse ce document de mutuelle. Extrais les informations et retourne-les
      UNIQUEMENT sous forme d'un objet JSON.
      Voici la structure exacte que tu dois utiliser :
      {
        "Numero_Contrat": "le numéro de contrat",
        "Numero_Affiliation": "le numéro d'affiliation",
        "Matricule_Ste": "le matricule de la société",
        "Nom_Prenom_Assure": "le nom et prénom de l'assuré",
        "Type_Declaration": "le type de déclaration (Medical, Dentaire, Optique)",
        "Total_Frais_Engages": "le montant total des frais engagés (format nombre)",
        "Date_Consultation": "la date de la consultation (format YYYY-MM-DD)",
        "Nom_Prenom_Malade": "le nom et prénom du malade",
        "Age_Malade": "l'âge du malade (format nombre)",
        "Lien_Parente": "le lien de parenté (Lui-meme, Conjoint, Enfants)",
        "Nature_Maladie": "la nature de la maladie"
      }
      Ne mets aucun texte avant ou après le JSON. Si un champ n'est pas trouvé, laisse sa valeur vide ou null.
      Pour 'Type_Declaration' et 'Lien_Parente', choisis la valeur la plus appropriée parmi les options fournies.
    `;

    const base64 = await fs.readFile(req.file.path, { encoding: 'base64' });
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { data: base64, mimeType: req.file.mimetype } }
    ]);

    const text = result.response.text();
    // Tenter de trouver le JSON même s'il y a du texte avant/après
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    let jsonString = text;
    if (start !== -1 && end !== -1 && end > start) {
      jsonString = text.slice(start, end + 1);
    } else {
      // Si le JSON n'est pas trouvé ou mal formaté, tenter de le réparer ou logguer
      console.warn("⚠️ JSON non trouvé ou mal formé dans la réponse Gemini:", text);
      // Optionnel: tenter une extraction regex plus robuste ou un parsing plus tolérant ici
    }

    const extracted = JSON.parse(jsonString);
    console.log("🤖 Données extraites par Gemini :", extracted); // Pour vérifier ce que l'IA renvoie
    res.json(extracted);

  } catch (error) {
    console.error("❌ Erreur détaillée de l'API Gemini:", error);
    // Loguer la réponse brute de l'IA si elle cause l'erreur de parsing
    if (error.response && error.response.text) {
        console.error("Réponse brute de l'IA:", error.response.text());
    }
    res.status(500).json({ error: 'Erreur Gemini lors de l\'extraction OCR' });
  }
});

// --- NOUVELLE CONFIGURATION MULTER POUR LES FICHIERS EXCEL ---
const excelStorage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir), // Utilisez le même répertoire d'upload ou un nouveau
  filename: (_, file, cb) => cb(null, `employes_${Date.now()}${path.extname(file.originalname)}`)
});
const uploadExcel = multer({ storage: excelStorage });

// --- NOUVELLE ROUTE POUR L'UPLOAD DE FICHIERS EXCEL D'EMPLOYÉS ---
app.post('/api/employes/upload-excel', uploadExcel.single('excelFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier Excel reçu.' });
    }

    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Prend la première feuille
    const worksheet = workbook.Sheets[sheetName];

    // Convertit la feuille en tableau JSON
    // header: 1 pour utiliser la première ligne comme en-tête
    const excelData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (excelData.length === 0) {
      // Supprimer le fichier vide si nécessaire
      await fs.unlink(filePath);
      return res.status(400).json({ success: false, message: 'Le fichier Excel est vide.' });
    }

    // Supposons que la première ligne contient les en-têtes
    const headers = excelData[0];
    const rows = excelData.slice(1);

    const newEmployes = rows.map(row => {
      const employee = {};
      headers.forEach((header, index) => {
        // Nettoyer les noms d'en-tête pour correspondre aux clés JSON
        const cleanHeader = header.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, ''); // Ex: "Matricule Employe" -> "Matricule_Employe"
        employee[cleanHeader] = row[index];
      });

      // Assurez-vous que les champs obligatoires existent et sont au bon format
      // Exemple de mapping et de formatage
      return {
        Matricule_Employe: String(employee.Matricule_Employe || '').trim(),
        Nom_Employe: String(employee.Nom_Employe || '').trim(),
        Prenom_Employe: String(employee.Prenom_Employe || '').trim(),
        DateNaissance: employee.DateNaissance ? new Date(employee.DateNaissance).toISOString().split('T')[0] : '', // Convertir date si nécessaire
        Famille: [], // Initialiser la famille comme vide pour un upload simple
        // Ajoutez d'autres champs si votre Excel les contient
        Numero_Contrat: String(employee.Numero_Contrat || '').trim(),
        Numero_Affiliation: String(employee.Numero_Affiliation || '').trim(),
        Nom_Prenom_Assure: String(employee.Nom_Prenom_Assure || '').trim(), // Si cette colonne existe dans Excel
      };
    }).filter(emp => emp.Matricule_Employe); // Filtrer les lignes sans matricule

    // Optionnel: Fusionner ou écraser les données existantes
    // Pour une solution hybride simple, nous allons écraser le fichier employes.json
    // Si vous voulez fusionner, vous devrez lire l'ancien fichier, ajouter/mettre à jour les employés, puis écrire.
    await fs.writeJson(EMPLOYES_FILE, newEmployes, { spaces: 2 });

    // Supprimer le fichier Excel temporaire après traitement
    await fs.unlink(filePath);

    res.json({ success: true, message: `${newEmployes.length} employés importés avec succès depuis Excel.` });

  } catch (error) {
    console.error("❌ Erreur lors de l'importation du fichier Excel des employés :", error);
    res.status(500).json({ success: false, message: "Erreur serveur lors de l'importation Excel." });
  }
});


// 📤 Export Excel bordereau - Génère fichier avec colonnes personnalisées Cosumar
const ExcelJS = require('exceljs'); // Assure-toi de l'importer en haut du fichier

app.post('/api/export-bordereau', async (req, res) => {
  try {
    const dossiers = req.body;
    if (!Array.isArray(dossiers) || dossiers.length === 0)
      return res.status(400).json({ error: "Aucun dossier à exporter" });

    const now = new Date();
    const filename = `bordereau_${now.toISOString().slice(0, 19).replace(/[:T]/g, "-")}.xlsx`;
    const filepath = path.join(bordereauxDir, filename);

    // Charger le template
    const templatePath = path.join(__dirname, 'templates', 'template_bordereau.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    // Prend la première feuille (ou adapte getWorksheet)
    const worksheet = workbook.getWorksheet('Feuil1');

    // 📌 ADAPTE LA LIGNE DE DÉPART SI BESOIN ! Ici ligne 4 :
    let rowIndex = 4;

    dossiers.forEach(d => {
      worksheet.getRow(rowIndex).getCell(1).value = d["N° Police"] || d.Numero_Contrat || "";
      worksheet.getRow(rowIndex).getCell(2).value = d["N° Adhésion"] || d.Numero_Affiliation || "";
      worksheet.getRow(rowIndex).getCell(3).value = d["Matricule"] || d.Matricule_Employe || d.Matricule_Ste || "";
      worksheet.getRow(rowIndex).getCell(4).value = d["Nom/Prénom"] || `${d.Nom_Employe || ''} ${d.Prenom_Employe || ''}`.trim();
      worksheet.getRow(rowIndex).getCell(5).value = d["Numéro dossier"] || d.Numero_Declaration || "";
      worksheet.getRow(rowIndex).getCell(6).value = d["Lien parenté"] || d.Lien_Parente || d.Ayant_Droit || "";
      worksheet.getRow(rowIndex).getCell(7).value = d["Montant"] || d.Montant || d.Total_Frais_Engages || "";
      rowIndex++;
    });

    await workbook.xlsx.writeFile(filepath);

    // --- Historique JSON et synthétique ---
    const jsonFilename = filename.replace('.xlsx', '.json');
    const jsonPath = path.join(bordereauxDir, jsonFilename);
    const jsonData = { dossiers };
    await fs.writeJson(jsonPath, jsonData, { spaces: 2 });

    const nbDossiers = dossiers.length;
    const total = dossiers.reduce((sum, d) => sum + parseFloat(d["Montant"] || d.Montant || 0), 0).toFixed(2);

    const historique = fs.existsSync(bordereauxHistoryFile)
      ? fs.readJsonSync(bordereauxHistoryFile)
      : [];
    historique.unshift({
      id: `BORD-${historique.length + 1}`,
      filename,
      date: now.toISOString(),
      nbDossiers,
      total,
      rembourse: total
    });
    fs.writeJsonSync(bordereauxHistoryFile, historique, { spaces: 2 });

    res.json({ success: true, filename });
  } catch (err) {
    console.error("❌ Erreur export bordereau (template) :", err);
    res.status(500).json({ error: "Erreur export bordereau (template)" });
  }
});



// 📜 Historique unifié des bordereaux
app.get('/api/bordereaux', (_, res) => {
  try {
    const raw = fs.readJsonSync(bordereauxHistoryFile);
    const data = raw.map(item => {
      // nbDossiers : nouveau champ ou ancien "nombre" ou longueur de "dossiers"
      const nb = item.nbDossiers ?? item.nombre ?? (item.dossiers?.length ?? 0);
      // total : on garde tel quel, en utilisant Total_Frais_Engages si disponible
      const total = parseFloat(item.total || item.dossiers?.reduce((sum, d) => sum + parseFloat(d.Total_Frais_Engages || 0), 0) || 0).toFixed(2);
      // rembourse : nouveau champ ou calcul depuis "dossiers"
      const rembourse = item.rembourse
        ? parseFloat(item.rembourse).toFixed(2)
        : (
            item.dossiers?.reduce(
              (sum, d) => sum + parseFloat(d.Montant_Rembourse || 0), // Assurez-vous que Montant_Rembourse existe
              0
            ) ?? 0
          ).toFixed(2);

      return {
        id: item.id,
        filename: item.filename || '',
        date: item.date,
        nbDossiers: nb,
        total,
        rembourse
      };
    });
    res.json(data);
  } catch (err) {
    console.error("Erreur lecture bordereaux:", err);
    res.status(500).json({ error: 'Erreur lecture bordereaux' });
  }
});

// 🔎 Recherche globale dans tous les fichiers JSON de /bordereaux
app.get('/api/dossiers-bordereaux', async (req, res) => {
  try {
    const fichiers = await fs.readdir(bordereauxDir);
    const fichiersJson = fichiers.filter(f =>
      f.endsWith('.json') &&
      f !== 'dossiers.json' && // Exclure ce fichier s'il est utilisé pour autre chose
      !f.startsWith('~') &&
      !f.startsWith('.') &&
      f !== 'bordereaux.json' // Exclure le fichier d'historique des bordereaux
    );

    let tousLesDossiers = [];

    for (const fichier of fichiersJson) {
      const contenu = await fs.readJson(path.join(bordereauxDir, fichier));

      let dossiers = [];

      if (Array.isArray(contenu)) {
        // Cas : JSON est un tableau direct
        dossiers = contenu;
      } else if (Array.isArray(contenu?.dossiers)) {
        // Cas : JSON contient une clé "dossiers"
        dossiers = contenu.dossiers;
      }

      // Ajoute le nom du fichier source à chaque dossier
      tousLesDossiers.push(
        ...dossiers.map(d => ({
          ...d,
          fichier: fichier.replace('.json', '')
        }))
      );
    }

    res.json(tousLesDossiers);
  } catch (err) {
    console.error("❌ Erreur lecture dossiers bordereaux :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


// ✅ Route test
app.get('/', (_, res) => res.send('✅ Backend JSON opérationnel'));

// 🚀 Lancement serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log(`>>> Backend CosuMutuel démarré sur le port ${PORT}`);
  console.log(`✅ Serveur backend JSON lancé sur http://localhost:${PORT}`);
});
