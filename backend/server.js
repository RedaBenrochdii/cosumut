// 🔐 .env (optionnel en prod Docker)
try { require('dotenv').config(); }
catch { console.warn("ℹ️ dotenv non installé, on continue (ENV via Docker)."); }

// OCR optionnel
const HAS_GEMINI = !!process.env.GEMINI_API_KEY;
if (!HAS_GEMINI) console.warn("⚠️ Aucune GEMINI_API_KEY: la route OCR sera désactivée.");

// 🌐 Dépendances
const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-.env';
const { GoogleGenerativeAI } = HAS_GEMINI ? require('@google/generative-ai') : { GoogleGenerativeAI: null };

// (fallbacks si modules absents chez toi)
let dataStorage = null;
try { dataStorage = require('./services/storage'); } catch (_) { dataStorage = { employes: { list: async()=>[] }, dossiers: { list: async()=>[] } }; }
let uploadRoute = null;
try { uploadRoute = require('./routes/uploadRoute'); } catch (_) { uploadRoute = express.Router(); }

// ✅ OCR init
const genAI = HAS_GEMINI ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// ✅ Server
const app = express();
const PORT = process.env.PORT || 4001;

// ✅ Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', uploadRoute);

// 📁 Paths
const EMPLOYES_FILE         = path.join(__dirname, 'data', 'employes.json');
const DATA_FILE             = path.join(__dirname, 'documents.json');
const uploadDir             = path.join(__dirname, 'uploads');
const bordereauxDir         = path.join(__dirname, 'bordereaux');
const bordereauxHistoryFile = path.join(__dirname, 'data', 'bordereaux.json');
const USERS_FILE            = path.join(__dirname, 'data', 'users.json');

fs.ensureDirSync(path.join(__dirname, 'data'));
fs.ensureDirSync(uploadDir);
fs.ensureDirSync(bordereauxDir);

app.use('/uploads', express.static(uploadDir));
app.use('/bordereaux', express.static(bordereauxDir));

/* =========================================================
   ⚙️ Options legacy JSON (désactivé par défaut)
========================================================= */
const LEGACY_JSON_BORD = (process.env.LEGACY_JSON_BORD || 'false').toLowerCase() === 'true';

/* =========================================================
   🔀 Sélection du driver (SQLite par défaut)
========================================================= */
const DRIVER   = (process.env.STORAGE_DRIVER || 'sqlite').toLowerCase();
const useSqlite = DRIVER === 'sqlite';
const useMssql  = DRIVER === 'mssql';

/* =========================================================
   🗄️ SQLite (DB + migrations + prepared statements)
========================================================= */
let db = null;
let sql = {};

if (useSqlite) {
  const Database = require('better-sqlite3');
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'cosumutuel.db');
  fs.ensureDirSync(path.dirname(dbPath));
  db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  // 🔤 Comparaisons accent-insensibles côté SQLite
  db.function('unaccent', (s) => (s == null ? '' : String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')));

  // Schéma
  db.exec(`
    CREATE TABLE IF NOT EXISTS Employes (
      Matricule_Employe   TEXT PRIMARY KEY,
      Nom_Employe         TEXT NOT NULL,
      Prenom_Employe      TEXT NOT NULL,
      DateNaissance       TEXT,
      Numero_Contrat      TEXT,
      Numero_Affiliation  TEXT
    );

    CREATE TABLE IF NOT EXISTS Familles (
      Id                INTEGER PRIMARY KEY AUTOINCREMENT,
      Matricule_Employe TEXT NOT NULL,
      type              TEXT CHECK(type IN ('conjoint','enfant')) NOT NULL,
      nom               TEXT,
      prenom            TEXT,
      DateNaissance     TEXT,
      FOREIGN KEY (Matricule_Employe) REFERENCES Employes(Matricule_Employe) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_familles_m ON Familles(Matricule_Employe);

    CREATE TABLE IF NOT EXISTS Dossiers (
      Id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      DateConsultation    TEXT,
      Numero_Contrat      TEXT,
      Numero_Affiliation  TEXT,
      Matricule_Employe   TEXT,
      Nom_Employe         TEXT,
      Prenom_Employe      TEXT,
      Nom_Malade          TEXT,
      Prenom_Malade       TEXT,
      Nature_Maladie      TEXT,
      Type_Malade         TEXT,
      Montant             REAL,
      Montant_Rembourse   REAL DEFAULT 0,
      Code_Assurance      TEXT,
      Numero_Declaration  TEXT,
      Ayant_Droit         TEXT,
      CreatedAt           TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS Bordereaux (
      Id           INTEGER PRIMARY KEY AUTOINCREMENT,
      filename     TEXT NOT NULL,
      date         TEXT NOT NULL,
      nbDossiers   INTEGER NOT NULL DEFAULT 0,
      total        REAL NOT NULL DEFAULT 0,
      rembourse    REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS Bordereaux_Dossiers (
      Id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      BordereauId        INTEGER NOT NULL,
      Numero_Declaration TEXT,
      Matricule_Employe  TEXT,
      Nom_Employe        TEXT,
      Prenom_Employe     TEXT,
      Montant            REAL,
      FOREIGN KEY (BordereauId) REFERENCES Bordereaux(Id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_bordereaux_date ON Bordereaux(date DESC);
    CREATE INDEX IF NOT EXISTS idx_bordereaux_items_bid ON Bordereaux_Dossiers(BordereauId);

    -- 👤 Users (SQLite)
    CREATE TABLE IF NOT EXISTS Users (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'agent',
      CreatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrations souples
  function hasCol(table, col) {
    return !!db.prepare(`SELECT 1 FROM pragma_table_info('${table}') WHERE name=?`).get(col);
  }
  function addCol(table, col, ddl) {
    if (!hasCol(table, col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
  addCol('Dossiers','Nature_Maladie',`Nature_Maladie TEXT`);
  addCol('Dossiers','Type_Malade',`Type_Malade TEXT`);
  addCol('Dossiers','Montant_Rembourse',`Montant_Rembourse REAL DEFAULT 0`);
  addCol('Dossiers','Code_Assurance',`Code_Assurance TEXT`);
  addCol('Dossiers','Ayant_Droit',`Ayant_Droit TEXT`);
  addCol('Dossiers','CreatedAt',`CreatedAt TEXT DEFAULT (datetime('now'))`);
  addCol('Employes','Numero_Contrat',`Numero_Contrat TEXT`);
  addCol('Employes','Numero_Affiliation',`Numero_Affiliation TEXT`);

  // Prepared statements
  sql.upsertEmploye = db.prepare(`
    INSERT INTO Employes (Matricule_Employe, Nom_Employe, Prenom_Employe, DateNaissance, Numero_Contrat, Numero_Affiliation)
    VALUES (@Matricule_Employe, @Nom_Employe, @Prenom_Employe, @DateNaissance, @Numero_Contrat, @Numero_Affiliation)
    ON CONFLICT(Matricule_Employe) DO UPDATE SET
      Nom_Employe        = excluded.Nom_Employe,
      Prenom_Employe     = excluded.Prenom_Employe,
      DateNaissance      = excluded.DateNaissance,
      Numero_Contrat     = excluded.Numero_Contrat,
      Numero_Affiliation = excluded.Numero_Affiliation
  `);
  sql.delFamilleForMat = db.prepare(`DELETE FROM Familles WHERE Matricule_Employe = ?`);
  sql.insertFamille = db.prepare(`
    INSERT INTO Familles (Matricule_Employe, type, nom, prenom, DateNaissance)
    VALUES (?, ?, ?, ?, ?)
  `);
  sql.insertDossier = db.prepare(`
    INSERT INTO Dossiers (
      DateConsultation, Numero_Contrat, Numero_Affiliation, Matricule_Employe,
      Nom_Employe, Prenom_Employe, Nom_Malade, Prenom_Malade, Nature_Maladie,
      Type_Malade, Montant, Montant_Rembourse, Code_Assurance, Numero_Declaration, Ayant_Droit
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  sql.insertBordereau = db.prepare(`
    INSERT INTO Bordereaux (filename, date, nbDossiers, total, rembourse)
    VALUES (?, ?, ?, ?, ?)
  `);
  sql.insertBordereauItem = db.prepare(`
    INSERT INTO Bordereaux_Dossiers (BordereauId, Numero_Declaration, Matricule_Employe, Nom_Employe, Prenom_Employe, Montant)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  console.log('🗄️ SQLite path:', path.resolve(process.env.DB_PATH || path.join(__dirname,'data','cosumutuel.db')));
}

/* =========================================================
   🗄️ MSSQL (DB + schéma + helpers)
========================================================= */
const sqlsrv = useMssql ? require('mssql') : null;
let mssqlPoolPromise = null;

async function getMssqlPool() {
  if (!useMssql) return null;
  if (!mssqlPoolPromise) {
    mssqlPoolPromise = sqlsrv.connect({
      server:   process.env.MSSQL_SERVER || 'localhost',
      database: process.env.MSSQL_DATABASE || 'cosumutuel',
      user:     process.env.MSSQL_USER,
      password: process.env.MSSQL_PASSWORD,
      port:     Number(process.env.MSSQL_PORT || 1433),
      options: {
        encrypt: (process.env.MSSQL_ENCRYPT ?? 'true') !== 'false',
        trustServerCertificate: (process.env.MSSQL_TRUST_SERVER_CERTIFICATE ?? 'true') === 'true',
        instanceName: process.env.MSSQL_INSTANCE || undefined
      }
    }).then(pool => { console.log('🔗 MSSQL connecté'); return pool; });
  }
  return mssqlPoolPromise;
}

async function ensureMssqlSchema() {
  const pool = await getMssqlPool();
  await pool.request().batch(`
IF OBJECT_ID('dbo.Employes','U') IS NULL
CREATE TABLE dbo.Employes (
  Matricule_Employe    NVARCHAR(50)  NOT NULL PRIMARY KEY,
  Nom_Employe          NVARCHAR(200) NOT NULL,
  Prenom_Employe       NVARCHAR(200) NOT NULL,
  DateNaissance        DATE NULL,
  Numero_Contrat       NVARCHAR(100) NULL,
  Numero_Affiliation   NVARCHAR(100) NULL
);

IF OBJECT_ID('dbo.Familles','U') IS NULL
CREATE TABLE dbo.Familles (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  Matricule_Employe NVARCHAR(50) NOT NULL,
  type  NVARCHAR(20) NOT NULL CHECK (type IN ('conjoint','enfant')),
  nom   NVARCHAR(200) NULL,
  prenom NVARCHAR(200) NULL,
  DateNaissance DATE NULL
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_familles_m')
  CREATE INDEX idx_familles_m ON dbo.Familles(Matricule_Employe);

IF OBJECT_ID('dbo.Dossiers','U') IS NULL
CREATE TABLE dbo.Dossiers (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  DateConsultation DATE NULL,
  Numero_Contrat NVARCHAR(100) NULL,
  Numero_Affiliation NVARCHAR(100) NULL,
  Matricule_Employe NVARCHAR(50) NULL,
  Nom_Employe NVARCHAR(200) NULL,
  Prenom_Employe NVARCHAR(200) NULL,
  Nom_Malade NVARCHAR(200) NULL,
  Prenom_Malade NVARCHAR(200) NULL,
  Nature_Maladie NVARCHAR(500) NULL,
  Type_Malade NVARCHAR(50) NULL,
  Montant DECIMAL(18,2) NULL,
  Montant_Rembourse DECIMAL(18,2) NOT NULL DEFAULT 0,
  Code_Assurance NVARCHAR(50) NULL,
  Numero_Declaration NVARCHAR(100) NULL,
  Ayant_Droit NVARCHAR(50) NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID('dbo.Bordereaux','U') IS NULL
CREATE TABLE dbo.Bordereaux (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  filename NVARCHAR(255) NOT NULL,
  date DATETIME2 NOT NULL,
  nbDossiers INT NOT NULL DEFAULT 0,
  total DECIMAL(18,2) NOT NULL DEFAULT 0,
  rembourse DECIMAL(18,2) NOT NULL DEFAULT 0
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_bordereaux_date')
  CREATE INDEX idx_bordereaux_date ON dbo.Bordereaux(date DESC);

IF OBJECT_ID('dbo.Bordereaux_Dossiers','U') IS NULL
CREATE TABLE dbo.Bordereaux_Dossiers (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  BordereauId INT NOT NULL FOREIGN KEY REFERENCES dbo.Bordereaux(Id) ON DELETE CASCADE,
  Numero_Declaration NVARCHAR(100) NULL,
  Matricule_Employe NVARCHAR(50) NULL,
  Nom_Employe NVARCHAR(200) NULL,
  Prenom_Employe NVARCHAR(200) NULL,
  Montant DECIMAL(18,2) NULL
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_bordereaux_items_bid')
  CREATE INDEX idx_bordereaux_items_bid ON dbo.Bordereaux_Dossiers(BordereauId);

-- 👤 Users (MSSQL)
IF OBJECT_ID('dbo.Users','U') IS NULL
CREATE TABLE dbo.Users (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  username NVARCHAR(100) UNIQUE NOT NULL,
  password_hash NVARCHAR(500) NOT NULL,
  role NVARCHAR(50) NOT NULL DEFAULT 'agent',
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
`);
  console.log('🧾 MSSQL schéma vérifié');
}

// seed de base (admin/agent) si table vide
async function seedDefaultUsers() {
  if (!useMssql) return;
  try {
    const pool = await getMssqlPool();
    const count = (await pool.request().query('SELECT COUNT(*) AS c FROM dbo.Users')).recordset[0].c;
    if (count > 0) return;
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
    const agentPass = process.env.AGENT_PASSWORD || 'agent123';
    const adminHash = await bcrypt.hash(adminPass, 10);
    const agentHash = await bcrypt.hash(agentPass, 10);
    await pool.request()
      .input('u1', sqlsrv.NVarChar(100), 'admin')
      .input('p1', sqlsrv.NVarChar(500), adminHash)
      .input('r1', sqlsrv.NVarChar(50), 'admin')
      .query('INSERT INTO dbo.Users (username,password_hash,role) VALUES (@u1,@p1,@r1)');
    await pool.request()
      .input('u2', sqlsrv.NVarChar(100), 'agent')
      .input('p2', sqlsrv.NVarChar(500), agentHash)
      .input('r2', sqlsrv.NVarChar(50), 'agent')
      .query('INSERT INTO dbo.Users (username,password_hash,role) VALUES (@u2,@p2,@r2)');
    console.log('👤 Users seed: admin/agent créés (pense à changer les mots de passe via .env)');
  } catch (e) { console.warn('Seed users skipped:', e.message); }
}

if (useMssql) {
  ensureMssqlSchema()
    .then(seedDefaultUsers)
    .catch(e => { console.error('❌ MSSQL init:', e); process.exit(1); });
}

/* =========================================================
   ℹ️ Storage / stats
========================================================= */
app.get('/api/storage/driver', async (_req, res) => {
  const info = { driver: DRIVER, dbPath: null };
  if (useSqlite) info.dbPath = process.env.DB_PATH || path.join(__dirname,'data','cosumutuel.db');
  if (useMssql)  info.dbPath = process.env.MSSQL_DATABASE;
  res.json(info);
});

app.get('/api/storage/stats', async (_req, res) => {
  try {
    if (useMssql) {
      const pool = await getMssqlPool();
      const q = async (t) => (await pool.request().query(`SELECT COUNT(*) AS c FROM ${t}`)).recordset[0].c;
      return res.json({
        employes:   await q('dbo.Employes'),
        famille:    await q('dbo.Familles'),
        dossiers:   await q('dbo.Dossiers'),
        bordereaux: await q('dbo.Bordereaux'),
        bordItems:  await q('dbo.Bordereaux_Dossiers'),
        users:      await q('dbo.Users')
      });
    }
    if (useSqlite) {
      const count = (s) => db.prepare(s).get().count;
      return res.json({
        employes:    count('SELECT COUNT(*) AS count FROM Employes'),
        famille:     count('SELECT COUNT(*) AS count FROM Familles'),
        dossiers:    count('SELECT COUNT(*) AS count FROM Dossiers'),
        bordereaux:  count('SELECT COUNT(*) AS count FROM Bordereaux'),
        bordItems:   count('SELECT COUNT(*) AS count FROM Bordereaux_Dossiers'),
        users:       count('SELECT COUNT(*) AS count FROM Users')
      });
    }
    const emp = await dataStorage.employes.list();
    const dos = await (dataStorage.dossiers.list?.() || []);
    return res.json({ employes: emp.length, famille: 0, dossiers: dos.length, bordereaux: 0, bordItems: 0, users: 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* =========================================================
   🔑 Auth (SQL Server + JWT) — JSON/SQLite fallback
========================================================= */
function authMiddleware(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token manquant' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide/expiré' });
  }
}

app.post('/api/register', async (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username et password requis' });
  try {
    if (useMssql) {
      const pool = await getMssqlPool();
      const exists = await pool.request().input('u', sqlsrv.NVarChar(100), username).query('SELECT 1 FROM dbo.Users WHERE username=@u');
      if (exists.recordset.length) return res.status(409).json({ error: 'Utilisateur déjà existant' });
      const hash = await bcrypt.hash(password, 10);
      await pool.request()
        .input('u', sqlsrv.NVarChar(100), username)
        .input('p', sqlsrv.NVarChar(500), hash)
        .input('r', sqlsrv.NVarChar(50), role || 'agent')
        .query('INSERT INTO dbo.Users (username,password_hash,role) VALUES (@u,@p,@r)');
      return res.json({ success: true, message: 'Utilisateur créé' });
    }
    if (useSqlite) {
      const exists = db.prepare('SELECT 1 AS x FROM Users WHERE username=?').get(username);
      if (exists) return res.status(409).json({ error: 'Utilisateur déjà existant' });
      const hash = await bcrypt.hash(password, 10);
      db.prepare('INSERT INTO Users (username,password_hash,role) VALUES (?,?,?)').run(username, hash, role || 'agent');
      return res.json({ success: true, message: 'Utilisateur créé (SQLite)' });
    }
    // JSON fallback
    const users = fs.existsSync(USERS_FILE) ? fs.readJsonSync(USERS_FILE) : [];
    if (users.find(u => u.username === username)) return res.status(409).json({ error: 'Utilisateur déjà existant' });
    const hash = await bcrypt.hash(password, 10);
    users.push({ username, password_hash: hash, role: role || 'agent' });
    await fs.writeJson(USERS_FILE, users, { spaces: 2 });
    return res.json({ success: true, message: 'Utilisateur créé (JSON)' });
  } catch (err) {
    console.error('❌ /api/register:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username et password requis' });
  try {
    if (useMssql) {
      const pool = await getMssqlPool();
      const r = await pool.request().input('u', sqlsrv.NVarChar(100), username).query('SELECT TOP 1 * FROM dbo.Users WHERE username=@u');
      if (!r.recordset.length) return res.status(401).json({ error: 'Utilisateur introuvable' });
      const user = r.recordset[0];
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(401).json({ error: 'Mot de passe invalide' });
      const token = jwt.sign({ id: user.Id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '2h' });
      return res.json({ success: true, token, role: user.role });
    }
    if (useSqlite) {
      const user = db.prepare('SELECT * FROM Users WHERE username=?').get(username);
      if (!user) return res.status(401).json({ error: 'Identifiants invalides' });
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(401).json({ error: 'Identifiants invalides' });
      const token = jwt.sign({ id: user.Id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '2h' });
      return res.json({ success: true, token, role: user.role });
    }
    // JSON fallback
    const users = fs.existsSync(USERS_FILE) ? fs.readJsonSync(USERS_FILE) : [];
    const user = users.find(u => u.username === username);
    if (!user) return res.status(401).json({ error: 'Identifiants invalides' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Identifiants invalides' });
    const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '2h' });
    res.json({ success: true, token, role: user.role });
  } catch (err) {
    console.error('❌ /api/login:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/api/me', authMiddleware, (req, res) => { res.json({ user: req.user }); });

/* =========================================================
   👥 Employés
========================================================= */
app.get('/api/employes', async (_req, res) => {
  try {
    if (useMssql) {
      const pool = await getMssqlPool();
      const [emps, fams] = await Promise.all([
        pool.request().query('SELECT * FROM dbo.Employes ORDER BY Matricule_Employe'),
        pool.request().query('SELECT * FROM dbo.Familles ORDER BY Matricule_Employe, type, nom, prenom')
      ]);
      const famByMat = new Map();
      for (const f of fams.recordset) {
        if (!famByMat.has(f.Matricule_Employe)) famByMat.set(f.Matricule_Employe, []);
        famByMat.get(f.Matricule_Employe).push(f);
      }
      return res.json(emps.recordset.map(e => ({ ...e, Famille: famByMat.get(e.Matricule_Employe) || [] })));
    }

    if (useSqlite) {
      const rows = db.prepare(`SELECT * FROM Employes ORDER BY Matricule_Employe`).all();
      const famStmt = db.prepare(`SELECT * FROM Familles WHERE Matricule_Employe = ? ORDER BY type, nom, prenom`);
      const list = rows.map(e => ({ ...e, Famille: famStmt.all(e.Matricule_Employe) }));
      return res.json(list);
    }

    const data = fs.existsSync(EMPLOYES_FILE) ? fs.readJsonSync(EMPLOYES_FILE) : [];
    return res.json(data);
  } catch (err) {
    console.error("Erreur lecture employés:", err);
    res.status(500).json({ error: 'Erreur lecture employés' });
  }
});

app.post('/api/employes/add', async (req, res) => {
  try {
    const newEmp = req.body;

    // JSON local (legacy simple pour front déjà en place)
    const data = fs.existsSync(EMPLOYES_FILE) ? fs.readJsonSync(EMPLOYES_FILE) : [];
    if (data.some(e => e.Matricule_Employe === newEmp.Matricule_Employe)) {
      return res.status(409).json({ success: false, error: 'Employé déjà existant' });
    }
    data.push(newEmp);
    fs.writeFileSync(EMPLOYES_FILE, JSON.stringify(data, null, 2), 'utf-8');

    if (useMssql && newEmp.Matricule_Employe) {
      const pool = await getMssqlPool();
      await pool.request()
        .input('Matricule_Employe', sqlsrv.NVarChar(50), newEmp.Matricule_Employe)
        .input('Nom_Employe',      sqlsrv.NVarChar(200), newEmp.Nom_Employe || '')
        .input('Prenom_Employe',   sqlsrv.NVarChar(200), newEmp.Prenom_Employe || '')
        .input('DateNaissance',    sqlsrv.Date, newEmp.DateNaissance || null)
        .input('Numero_Contrat',   sqlsrv.NVarChar(100), newEmp.Numero_Contrat || '')
        .input('Numero_Affiliation', sqlsrv.NVarChar(100), newEmp.Numero_Affiliation || '')
        .query(`
MERGE dbo.Employes AS t
USING (SELECT @Matricule_Employe AS Matricule_Employe) AS s
ON (t.Matricule_Employe = s.Matricule_Employe)
WHEN MATCHED THEN UPDATE SET
  Nom_Employe=@Nom_Employe, Prenom_Employe=@Prenom_Employe, DateNaissance=@DateNaissance,
  Numero_Contrat=@Numero_Contrat, Numero_Affiliation=@Numero_Affiliation
WHEN NOT MATCHED THEN
  INSERT (Matricule_Employe,Nom_Employe,Prenom_Employe,DateNaissance,Numero_Contrat,Numero_Affiliation)
  VALUES (@Matricule_Employe,@Nom_Employe,@Prenom_Employe,@DateNaissance,@Numero_Contrat,@Numero_Affiliation);
`);
      await pool.request()
        .input('Matricule_Employe', sqlsrv.NVarChar(50), newEmp.Matricule_Employe)
        .query('DELETE FROM dbo.Familles WHERE Matricule_Employe=@Matricule_Employe');
      if (Array.isArray(newEmp.Famille)) {
        for (const f of newEmp.Famille) {
          await pool.request()
            .input('Matricule_Employe', sqlsrv.NVarChar(50), newEmp.Matricule_Employe)
            .input('type',   sqlsrv.NVarChar(20), (f.type||'').toLowerCase().includes('conj')?'conjoint':'enfant')
            .input('nom',    sqlsrv.NVarChar(200), f.nom||'')
            .input('prenom', sqlsrv.NVarChar(200), f.prenom||'')
            .input('DateNaissance', sqlsrv.Date, f.DateNaissance||null)
            .query('INSERT INTO dbo.Familles (Matricule_Employe,type,nom,prenom,DateNaissance) VALUES (@Matricule_Employe,@type,@nom,@prenom,@DateNaissance)');
        }
      }
    }

    if (useSqlite && newEmp.Matricule_Employe) {
      sql.upsertEmploye.run({
        Matricule_Employe: newEmp.Matricule_Employe,
        Nom_Employe: newEmp.Nom_Employe || '',
        Prenom_Employe: newEmp.Prenom_Employe || '',
        DateNaissance: newEmp.DateNaissance || null,
        Numero_Contrat: newEmp.Numero_Contrat || '',
        Numero_Affiliation: newEmp.Numero_Affiliation || ''
      });
      if (Array.isArray(newEmp.Famille)) {
        sql.delFamilleForMat.run(newEmp.Matricule_Employe);
        for (const f of newEmp.Famille) {
          const type = (f.type || '').toLowerCase().includes('conj') ? 'conjoint' : (f.type || 'enfant');
          sql.insertFamille.run(newEmp.Matricule_Employe, type, f.nom || '', f.prenom || '', f.DateNaissance || null);
        }
      }
    }

    res.json({ success: true, message: 'Employé ajouté', employe: newEmp });
  } catch (err) {
    console.error("Erreur ajout employé:", err);
    res.status(500).json({ error: 'Erreur ajout employé', details: err.message });
  }
});

app.get('/api/employes/:matricule', async (req, res) => {
  const { matricule } = req.params;
  try {
    if (fs.existsSync(EMPLOYES_FILE)) {
      const data = fs.readJsonSync(EMPLOYES_FILE);
      const emp = data.find(e => e.Matricule_Employe === matricule);
      if (emp) return res.json(emp);
    }
    if (useMssql) {
      const pool = await getMssqlPool();
      const emp = (await pool.request().input('m', sqlsrv.NVarChar(50), matricule)
        .query('SELECT * FROM dbo.Employes WHERE Matricule_Employe=@m')).recordset[0];
      if (!emp) return res.status(404).json({ error: 'Employé introuvable' });
      const fam = (await pool.request().input('m', sqlsrv.NVarChar(50), matricule)
        .query('SELECT * FROM dbo.Familles WHERE Matricule_Employe=@m ORDER BY type, nom, prenom')).recordset;
      return res.json({ ...emp, Famille: fam });
    }
    if (useSqlite) {
      const emp = db.prepare(`SELECT * FROM Employes WHERE Matricule_Employe = ?`).get(matricule);
      if (!emp) return res.status(404).json({ error: 'Employé introuvable' });
      const fam = db.prepare(`SELECT * FROM Familles WHERE Matricule_Employe = ? ORDER BY type, nom, prenom`).all(matricule);
      return res.json({ ...emp, Famille: fam });
    }
    return res.status(404).json({ error: 'Employé introuvable' });
  } catch (err) {
    console.error("Erreur récupération employé:", err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
// ✅ Dossiers
app.post('/api/dossiers', async (req, res) => {
  try {
    const dossier = req.body;
    if (!dossier || !dossier.Numero_Declaration) {
      return res.status(400).json({ error: 'Numéro de déclaration manquant' });
    }

    if (useMssql) {
      const pool = await getMssqlPool();
      await pool.request()
        .input('DateConsultation', sqlsrv.Date, dossier.DateConsultation || null)
        .input('Numero_Contrat', sqlsrv.NVarChar(100), dossier.Numero_Contrat || null)
        .input('Numero_Affiliation', sqlsrv.NVarChar(100), dossier.Numero_Affiliation || null)
        .input('Matricule_Employe', sqlsrv.NVarChar(50), dossier.Matricule_Employe || null)
        .input('Nom_Employe', sqlsrv.NVarChar(200), dossier.Nom_Employe || null)
        .input('Prenom_Employe', sqlsrv.NVarChar(200), dossier.Prenom_Employe || null)
        .input('Nom_Malade', sqlsrv.NVarChar(200), dossier.Nom_Malade || null)
        .input('Prenom_Malade', sqlsrv.NVarChar(200), dossier.Prenom_Malade || null)
        .input('Nature_Maladie', sqlsrv.NVarChar(500), dossier.Nature_Maladie || null)
        .input('Type_Malade', sqlsrv.NVarChar(50), dossier.Type_Malade || null)
        .input('Montant', sqlsrv.Decimal(18, 2), dossier.Montant)
        .input('Montant_Rembourse', sqlsrv.Decimal(18, 2), dossier.Montant_Rembourse)
        .input('Code_Assurance', sqlsrv.NVarChar(50), dossier.Code_Assurance || null)
        .input('Numero_Declaration', sqlsrv.NVarChar(100), dossier.Numero_Declaration)
        .input('Ayant_Droit', sqlsrv.NVarChar(50), dossier.Ayant_Droit || null)
        .query(`
          INSERT INTO dbo.Dossiers (
            DateConsultation, Numero_Contrat, Numero_Affiliation, Matricule_Employe,
            Nom_Employe, Prenom_Employe, Nom_Malade, Prenom_Malade, Nature_Maladie,
            Type_Malade, Montant, Montant_Rembourse, Code_Assurance, Numero_Declaration, Ayant_Droit
          ) VALUES (
            @DateConsultation, @Numero_Contrat, @Numero_Affiliation, @Matricule_Employe,
            @Nom_Employe, @Prenom_Employe, @Nom_Malade, @Prenom_Malade, @Nature_Maladie,
            @Type_Malade, @Montant, @Montant_Rembourse, @Code_Assurance, @Numero_Declaration, @Ayant_Droit
          );
        `);
    } else if (useSqlite) {
      sql.insertDossier.run(
        dossier.DateConsultation,
        dossier.Numero_Contrat,
        dossier.Numero_Affiliation,
        dossier.Matricule_Employe,
        dossier.Nom_Employe,
        dossier.Prenom_Employe,
        dossier.Nom_Malade,
        dossier.Prenom_Malade,
        dossier.Nature_Maladie,
        dossier.Type_Malade,
        dossier.Montant,
        dossier.Montant_Rembourse,
        dossier.Code_Assurance,
        dossier.Numero_Declaration,
        dossier.Ayant_Droit
      );
    } else {
      // Legacy JSON (si utilisé)
      const docs = fs.existsSync(DATA_FILE) ? await fs.readJson(DATA_FILE) : [];
      docs.push(dossier);
      await fs.writeJson(DATA_FILE, docs, { spaces: 2 });
    }
    res.json({ success: true, message: 'Dossier enregistré' });
  } catch (err) {
    console.error("❌ Erreur d'enregistrement du dossier:", err);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement du dossier', details: err.message });
  }
});

// ✅ Route pour lister tous les dossiers
app.get('/api/dossiers', async (req, res) => {
  try {
    if (useMssql) {
      const pool = await getMssqlPool();
      const result = await pool.request().query('SELECT * FROM dbo.Dossiers ORDER BY CreatedAt DESC');
      return res.json(result.recordset);
    }
    if (useSqlite) {
      const rows = db.prepare('SELECT * FROM Dossiers ORDER BY CreatedAt DESC').all();
      return res.json(rows);
    }
    const data = fs.existsSync(DATA_FILE) ? await fs.readJson(DATA_FILE) : [];
    res.json(data);
  } catch (err) {
    console.error("❌ Erreur lecture dossiers:", err);
    res.status(500).json({ error: 'Erreur lors de la récupération des dossiers' });
  }
});

/* =========================================================
   📥 Upload générique
========================================================= */
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename:   (_, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

app.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    const doc = { filename: req.file.filename, commentaire: req.body.commentaire, date: new Date().toISOString() };
    const oldData = fs.existsSync(DATA_FILE) ? await fs.readJson(DATA_FILE) : [];
    oldData.push(doc);
    await fs.writeJson(DATA_FILE, oldData, { spaces: 2 });
    res.json({ success: true, message: 'Document reçu' });
  } catch (err) {
    console.error("Erreur upload document:", err);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

app.get('/documents', async (_req, res) => {
  try {
    const data = fs.existsSync(DATA_FILE) ? await fs.readJson(DATA_FILE) : [];
    res.json(data);
  } catch (err) {
    console.error("Erreur lecture documents:", err);
    res.json([]); // pas d'erreur fatale pour UI
  }
});

/* =========================================================
   🤖 Gemini OCR (optionnel)
========================================================= */
if (HAS_GEMINI) {
  const ocrUpload = multer({ storage });
  app.post('/api/ocr/gemini', ocrUpload.single('image'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });

      const prompt = `
Analyse ce document et renvoie UNIQUEMENT du JSON strict :
{
  "Numero_Contrat": "", "Numero_Affiliation": "", "Matricule_Ste": "",
  "Nom_Prenom_Assure": "", "Type_Declaration": "Medical|Dentaire|Optique",
  "Total_Frais_Engages": "", "Date_Consultation": "YYYY-MM-DD",
  "Nom_Prenom_Malade": "", "Age_Malade": "", "Lien_Parente": "Lui-meme|Conjoint|Enfants",
  "Nature_Maladie": "", "Numero_Declaration": ""
}
Règles :
- "Numero_Declaration" = numéro de dossier/de déclaration imprimé (souvent **près du titre "DECLARATION DE MALADIE"** en haut à droite, ex. 8 chiffres).
- Si un champ est introuvable → laisse vide.
- "status" = "ok" si tous les champs clés sont présents, sinon "incomplet".
Ne renvoie que le JSON.
`;
      const base64 = await fs.readFile(req.file.path, { encoding: 'base64' });
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent([{ text: prompt }, { inlineData: { data: base64, mimeType: req.file.mimetype } }]);
      const text = result.response.text();
      const s = text.indexOf('{'), e = text.lastIndexOf('}');
      const jsonString = (s !== -1 && e !== -1 && e > s) ? text.slice(s, e+1) : '{}';
      res.json(JSON.parse(jsonString));
    } catch (error) {
      console.error("❌ Erreur OCR Gemini:", error);
      res.status(500).json({ error: "Erreur Gemini lors de l'extraction OCR" });
    }
  });
} else {
  app.post('/api/ocr/gemini', (_req, res) => res.status(503).json({ error: "OCR indisponible (GEMINI_API_KEY manquante)" }));
}

/* =========================================================
   📊 Import Excel Employés (1 feuille)
========================================================= */
const excelStorage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename:   (_, file, cb) => cb(null, `employes_${Date.now()}${path.extname(file.originalname)}`)
});
const uploadExcel = multer({ storage: excelStorage });

app.post('/api/employes/upload-excel', uploadExcel.single('excelFile'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Aucun fichier Excel reçu.' });

    const filePath = req.file.path;
    const book = XLSX.readFile(filePath);
    const sheet = book.Sheets[book.SheetNames[0]];
    if (!sheet) { await fs.unlink(filePath); return res.status(400).json({ success: false, message: 'Feuille Excel introuvable.' }); }

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!rows.length) { await fs.unlink(filePath); return res.status(400).json({ success: false, message: 'Fichier vide.' }); }

    const normKey = (s='') => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
    const toISO = (v) => {
      if (v == null || v==='') return '';
      const s = String(v).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
      if (m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
      const n = Number(s);
      if (!Number.isNaN(n) && n > 25569) {
        const d = new Date(Math.round((n - 25569) * 86400 * 1000));
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
      }
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
    };

    const headers = rows[0].map(h => String(h||'').trim());
    const H = headers.map(normKey);
    const idxOf = (pred) => H.findIndex(pred);
    const allIdx = (pred) => H.map((h,i)=>({h,i})).filter(x=>pred(x.h)).map(x=>x.i);

    const iMat    = idxOf(h => /(matricule(_employe)?|code_employe|matricule_salarie|matricule)$/.test(h));
    const iNomEmp = idxOf(h => h === 'nom');
    const iPreEmp = idxOf(h => h === 'prenom' || h === 'prnom');
    const iNaissEmp = idxOf(h => /(naissance|date_naissance)$/.test(h) && !/conjoint/.test(headers[H.indexOf(h)]||''));
    const iAff    = idxOf(h => /(n_daff|numero_affiliation|n_adhesion|nadhesion)/.test(h));
    const iPolice = idxOf(h => /(n_de_police|numero_contrat|police|n_police|npolice)/.test(h));

    const iPreConj  = idxOf(h => /prenom.*conjoint/.test(h));
    const iDateConj = idxOf(h => /date.*naissance.*conjoin/.test(h));
    const allNomIdx = allIdx(h => h === 'nom');
    const iNomConj = (iPreConj > -1)
      ? [...allNomIdx].reverse().find(i => i < iPreConj && i > (iPreEmp > -1 ? iPreEmp : -1)) ?? -1
      : -1;

    const iDateEnf = (() => {
      let idx = -1;
      for (let i = H.length - 1; i >= 0; i--) {
        const raw = headers[i] || '';
        const h = H[i];
        if (/^date_de_naissance$/.test(h) && !/conjoin/i.test(raw) && i !== iNaissEmp) { idx = i; break; }
      }
      return idx;
    })();
    const allPreIdx = allIdx(h => h === 'prenom' || h === 'prnom');
    const iPreEnf = (iDateEnf > -1)
      ? [...allPreIdx].reverse().find(i => i < iDateEnf && i !== iPreConj) ?? -1
      : -1;
    const iNomEnf = (iPreEnf > -1)
      ? [...allNomIdx].reverse().find(i => i < iPreEnf && i !== iNomEmp && i !== iNomConj) ?? -1
      : -1;

    const byMat = new Map();
    const getEmp = (m) => {
      if (!byMat.has(m)) byMat.set(m, {
        Matricule_Employe: m,
        Nom_Employe: '', Prenom_Employe: '', DateNaissance: '',
        Numero_Contrat: '', Numero_Affiliation: '',
        Nom_Prenom_Assure: '', Famille: []
      });
      return byMat.get(m);
    };

    let famCount = 0;
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const matricule = iMat > -1 ? String(row[iMat] || '').trim() : '';
      if (!matricule) continue;
      const emp = getEmp(matricule);

      const nomEmp = iNomEmp > -1 ? String(row[iNomEmp] || '').trim() : '';
      const preEmp = iPreEmp > -1 ? String(row[iPreEmp] || '').trim() : '';
      const dnEmp  = iNaissEmp > -1 ? row[iNaissEmp] : '';
      const aff    = iAff > -1 ? String(row[iAff] || '').trim() : '';
      const pol    = iPolice > -1 ? String(row[iPolice] || '').trim() : '';

      if (nomEmp) emp.Nom_Employe = emp.Nom_Employe || nomEmp;
      if (preEmp) emp.Prenom_Employe = emp.Prenom_Employe || preEmp;
      if (dnEmp)  emp.DateNaissance = emp.DateNaissance || toISO(dnEmp);
      if (aff)    emp.Numero_Affiliation = emp.Numero_Affiliation || aff;
      if (pol)    emp.Numero_Contrat = emp.Numero_Contrat || pol;

      const conjPre  = iPreConj  > -1 ? String(row[iPreConj] || '').trim() : '';
      const conjNom  = iNomConj  > -1 ? String(row[iNomConj] || '').trim() : '';
      const conjDate = iDateConj > -1 ? row[iDateConj] : '';
      if (conjPre || conjNom || conjDate) {
        const already = emp.Famille.find(f => f.type === 'conjoint' && (f.nom || f.prenom));
        if (!already) {
          emp.Famille.push({ type: 'conjoint', nom: conjNom || emp.Nom_Employe || '', prenom: conjPre || '', DateNaissance: conjDate ? toISO(conjDate) : '' });
          famCount++;
        }
      }

      const enfPre  = iPreEnf  > -1 ? String(row[iPreEnf] || '').trim() : '';
      const enfNom  = iNomEnf  > -1 ? String(row[iNomEnf] || '').trim() : '';
      const enfDate = iDateEnf > -1 ? row[iDateEnf] : '';
      if (enfPre || enfNom || enfDate) {
        emp.Famille.push({ type: 'enfant', nom: enfNom || emp.Nom_Employe || '', prenom: enfPre || '', DateNaissance: enfDate ? toISO(enfDate) : '' });
        famCount++;
      }
    }

    const newEmployes = Array.from(byMat.values());

    if (useMssql) {
      const pool = await getMssqlPool();
      for (const e of newEmployes) {
        await pool.request()
          .input('Matricule_Employe', sqlsrv.NVarChar(50), e.Matricule_Employe)
          .input('Nom_Employe', sqlsrv.NVarChar(200), e.Nom_Employe || '')
          .input('Prenom_Employe', sqlsrv.NVarChar(200), e.Prenom_Employe || '')
          .input('DateNaissance', sqlsrv.Date, e.DateNaissance || null)
          .input('Numero_Contrat', sqlsrv.NVarChar(100), e.Numero_Contrat || '')
          .input('Numero_Affiliation', sqlsrv.NVarChar(100), e.Numero_Affiliation || '')
          .query(`
MERGE dbo.Employes AS t
USING (SELECT @Matricule_Employe AS Matricule_Employe) AS s
ON (t.Matricule_Employe = s.Matricule_Employe)
WHEN MATCHED THEN UPDATE SET
  Nom_Employe=@Nom_Employe, Prenom_Employe=@Prenom_Employe, DateNaissance=@DateNaissance,
  Numero_Contrat=@Numero_Contrat, Numero_Affiliation=@Numero_Affiliation
WHEN NOT MATCHED THEN
  INSERT (Matricule_Employe,Nom_Employe,Prenom_Employe,DateNaissance,Numero_Contrat,Numero_Affiliation)
  VALUES (@Matricule_Employe,@Nom_Employe,@Prenom_Employe,@DateNaissance,@Numero_Contrat,@Numero_Affiliation);
`);
        await pool.request().input('Matricule_Employe', sqlsrv.NVarChar(50), e.Matricule_Employe)
          .query('DELETE FROM dbo.Familles WHERE Matricule_Employe=@Matricule_Employe');
        if (Array.isArray(e.Famille)) {
          for (const f of e.Famille) {
            await pool.request()
              .input('Matricule_Employe', sqlsrv.NVarChar(50), e.Matricule_Employe)
              .input('type', sqlsrv.NVarChar(20), (f.type||'').toLowerCase().includes('conj')?'conjoint':'enfant')
              .input('nom', sqlsrv.NVarChar(200), f.nom||'')
              .input('prenom', sqlsrv.NVarChar(200), f.prenom||'')
              .input('DateNaissance', sqlsrv.Date, f.DateNaissance||null)
              .query('INSERT INTO dbo.Familles (Matricule_Employe,type,nom,prenom,DateNaissance) VALUES (@Matricule_Employe,@type,@nom,@prenom,@DateNaissance)');
          }
        }
      }
      console.log(`✅ MSSQL: ${newEmployes.length} employés upsertés`);
    }

    if (useSqlite) {
      let upEmp=0, upFam=0;
      const tx = db.transaction(() => {
        for (const e of newEmployes) {
          sql.upsertEmploye.run({
            Matricule_Employe: e.Matricule_Employe,
            Nom_Employe: e.Nom_Employe || '',
            Prenom_Employe: e.Prenom_Employe || '',
            DateNaissance: e.DateNaissance || null,
            Numero_Contrat: e.Numero_Contrat || '',
            Numero_Affiliation: e.Numero_Affiliation || ''
          });
          upEmp++;
          sql.delFamilleForMat.run(e.Matricule_Employe);
          if (Array.isArray(e.Famille) && e.Famille.length) {
            for (const f of e.Famille) {
              sql.insertFamille.run(e.Matricule_Employe, (f.type||'').toLowerCase().includes('conj')?'conjoint':'enfant', f.nom||'', f.prenom||'', f.DateNaissance||null);
              upFam++;
            }
          }
        }
      });
      tx();
      console.log(`✅ SQLite: ${upEmp} employés upsertés, ${upFam} membres famille insérés`);
    }

    await fs.writeJson(EMPLOYES_FILE, newEmployes, { spaces: 2 });
    await fs.unlink(filePath);
    res.json({ success: true, message: `${newEmployes.length} employés importés (DB + JSON), ${famCount} membres famille.` });
  } catch (error) {
    console.error("❌ Erreur import Excel:", error);
    res.status(500).json({ success: false, message: "Erreur serveur lors de l'import Excel." });
  }
});

/* =========================================================
   🧾 Dossier (sauvegarde)
========================================================= */
app.post('/api/dossiers', async (req, res) => {
  try {
    const d = req.body || {};

    if (useMssql) {
      const pool = await getMssqlPool();
      await pool.request()
        .input('DateConsultation', sqlsrv.Date, d.DateConsultation || null)
        .input('Numero_Contrat', sqlsrv.NVarChar(100), d.Numero_Contrat || null)
        .input('Numero_Affiliation', sqlsrv.NVarChar(100), d.Numero_Affiliation || null)
        .input('Matricule_Employe', sqlsrv.NVarChar(50), d.Matricule_Employe || d.Matricule_Ste || null)
        .input('Nom_Employe', sqlsrv.NVarChar(200), d.Nom_Employe || null)
        .input('Prenom_Employe', sqlsrv.NVarChar(200), d.Prenom_Employe || null)
        .input('Nom_Malade', sqlsrv.NVarChar(200), d.Nom_Malade || null)
        .input('Prenom_Malade', sqlsrv.NVarChar(200), d.Prenom_Malade || null)
        .input('Nature_Maladie', sqlsrv.NVarChar(500), d.Nature_Maladie || null)
        .input('Type_Malade', sqlsrv.NVarChar(50), d.Type_Malade || d.Type_Declaration || null)
        .input('Montant', sqlsrv.Decimal(18,2), Number(d.Montant ?? d.Total_Frais_Engages ?? 0))
        .input('Montant_Rembourse', sqlsrv.Decimal(18,2), Number(d.Montant_Rembourse || 0))
        .input('Code_Assurance', sqlsrv.NVarChar(50), d.Code_Assurance || null)
        .input('Numero_Declaration', sqlsrv.NVarChar(100), d.Numero_Declaration || null)
        .input('Ayant_Droit', sqlsrv.NVarChar(50), d.Ayant_Droit || d.Lien_Parente || null)
        .query(`INSERT INTO dbo.Dossiers
          (DateConsultation,Numero_Contrat,Numero_Affiliation,Matricule_Employe,Nom_Employe,Prenom_Employe,Nom_Malade,Prenom_Malade,Nature_Maladie,Type_Malade,Montant,Montant_Rembourse,Code_Assurance,Numero_Declaration,Ayant_Droit)
          VALUES (@DateConsultation,@Numero_Contrat,@Numero_Affiliation,@Matricule_Employe,@Nom_Employe,@Prenom_Employe,@Nom_Malade,@Prenom_Malade,@Nature_Maladie,@Type_Malade,@Montant,@Montant_Rembourse,@Code_Assurance,@Numero_Declaration,@Ayant_Droit)`);
    }

    if (useSqlite) {
      sql.insertDossier.run(
        d.DateConsultation || null,
        d.Numero_Contrat || null,
        d.Numero_Affiliation || null,
        d.Matricule_Employe || d.Matricule_Ste || null,
        d.Nom_Employe || null,
        d.Prenom_Employe || null,
        d.Nom_Malade || null,
        d.Prenom_Malade || null,
        d.Nature_Maladie || null,
        d.Type_Malade || d.Type_Declaration || null,
        Number(d.Montant || d.Total_Frais_Engages || 0),
        Number(d.Montant_Rembourse || 0),
        d.Code_Assurance || null,
        d.Numero_Declaration || null,
        d.Ayant_Droit || d.Lien_Parente || null
      );
    }

    // JSON journalier (legacy) — facultatif
    if (LEGACY_JSON_BORD) {
      const day = new Date().toISOString().slice(0,10);
      const dailyJsonPath = path.join(bordereauxDir, `bordereau_${day}.json`);
      let payload = { dossiers: [] };
      if (await fs.pathExists(dailyJsonPath)) {
        payload = await fs.readJson(dailyJsonPath);
        if (!Array.isArray(payload.dossiers)) payload.dossiers = [];
      }
      payload.dossiers.push(d);
      if (await fs.pathExists(dailyJsonPath)) await fs.copy(dailyJsonPath, dailyJsonPath + '.bak');
      await fs.writeJson(dailyJsonPath, payload, { spaces: 2 });
    }

    res.json({ success: true });
  } catch (e) {
    console.error('❌ Erreur /api/dossiers :', e);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/* =========================================================
   📤 Export bordereau — SOUS entête + date auto + historique DB
========================================================= */
app.post('/api/export-bordereau', async (req, res) => {
  try {
    const dossiers = req.body;
    if (!Array.isArray(dossiers) || dossiers.length === 0) {
      return res.status(400).json({ error: "Aucun dossier à exporter" });
    }

    const now = new Date();
    const filename = `bordereau_${now.toISOString().slice(0, 19).replace(/[:T]/g, "-")}.xlsx`;
    const filepath = path.join(bordereauxDir, filename);

    const templatePath = path.join(__dirname, 'templates', 'template_bordereau.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const worksheet = workbook.getWorksheet('Feuil1') || workbook.worksheets[0];

    // 0) Date du jour à droite de "le"
    (function writeTodayNearLe() {
      const deaccent = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
      let anchor = null;
      worksheet.eachRow({ includeEmpty: true }, (row, r) => {
        row.eachCell({ includeEmpty: true }, (cell, c) => {
          const v = cell.value; if (typeof v !== 'string') return;
          const s = deaccent(v);
          if (s === 'le' || s.endsWith(' le') || s.endsWith('le:')) anchor = anchor || { r, c };
        });
      });
      const cell = anchor ? worksheet.getRow(anchor.r).getCell(anchor.c + 1) : worksheet.getCell('B3');
      cell.value = now; cell.numFmt = 'dd/mm/yyyy';
    })();

    // 1) Trouver l’entête
    const HEAD = ['N° Police','N° Adhésion','Matricule','Nom/Prénom','Numéro dossier','Lien parenté','Montant'];
    let headerRowIndex = -1;
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const first7 = [1,2,3,4,5,6,7].map(i => { const v=row.getCell(i).value; return (v==null?'':String(v)).trim(); });
      if (HEAD.every((t,i)=>first7[i]===t)) headerRowIndex = rowNumber;
    });
    if (headerRowIndex === -1) { headerRowIndex = 4; console.warn('⚠️ Entête non trouvée, fallback ligne 4'); }

    // 2) Insérer sous l’entête
    worksheet.spliceRows(headerRowIndex + 1, 0, ...Array.from({ length: dossiers.length }, () => []));
    let rowIndex = headerRowIndex + 1;

    // 3) Écrire lignes
    dossiers.forEach(d => {
      const r = worksheet.getRow(rowIndex++);
      r.getCell(1).value = d["N° Police"]      ?? d.Numero_Contrat      ?? "";
      r.getCell(2).value = d["N° Adhésion"]    ?? d.Numero_Affiliation  ?? "";
      r.getCell(3).value = d["Matricule"]      ?? d.Matricule_Employe   ?? d.Matricule_Ste ?? "";
      r.getCell(4).value = d["Nom/Prénom"]     ?? `${d.Nom_Employe || ''} ${d.Prenom_Employe || ''}`.trim();
      r.getCell(5).value = d["Numéro dossier"] ?? d.Numero_Declaration  ?? "";
      r.getCell(6).value = d["Lien parenté"]   ?? d.Lien_Parente        ?? d.Ayant_Droit ?? "";
      const montant = parseFloat(d["Montant"] ?? d.Montant ?? d.Total_Frais_Engages ?? 0) || 0;
      r.getCell(7).value = montant; r.getCell(7).numFmt = '#,##0.00';
      r.commit();
    });

    await workbook.xlsx.writeFile(filepath);

    // --- Historique JSON (legacy) facultatif
    if (LEGACY_JSON_BORD) {
      const jsonFilename = filename.replace('.xlsx', '.json');
      await fs.writeJson(path.join(bordereauxDir, jsonFilename), { dossiers }, { spaces: 2 });
    }

    const nbDossiers = dossiers.length;
    const totalNum = dossiers.reduce((sum, d) => {
      const v = parseFloat(d["Montant"] ?? d.Montant ?? d.Total_Frais_Engages ?? 0);
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);

    // --- Historique MSSQL
    if (useMssql) {
      const pool = await getMssqlPool();
      const insB = await pool.request()
        .input('filename', sqlsrv.NVarChar(255), filename)
        .input('date', sqlsrv.DateTime2, now.toISOString())
        .input('nb', sqlsrv.Int, nbDossiers)
        .input('total', sqlsrv.Decimal(18,2), totalNum)
        .input('remb', sqlsrv.Decimal(18,2), totalNum)
        .query(`INSERT INTO dbo.Bordereaux (filename,date,nbDossiers,total,rembourse)
                OUTPUT inserted.Id AS id VALUES (@filename,@date,@nb,@total,@remb)`);
      const bid = insB.recordset[0].id;

      for (const d of dossiers) {
        await pool.request()
          .input('bid', sqlsrv.Int, bid)
          .input('num', sqlsrv.NVarChar(100), d["Numéro dossier"] ?? d.Numero_Declaration ?? '')
          .input('mat', sqlsrv.NVarChar(50), d["Matricule"] ?? d.Matricule_Employe ?? d.Matricule_Ste ?? '')
          .input('nom', sqlsrv.NVarChar(200), d.Nom_Employe ?? '')
          .input('pre', sqlsrv.NVarChar(200), d.Prenom_Employe ?? '')
          .input('mnt', sqlsrv.Decimal(18,2), Number(d["Montant"] ?? d.Montant ?? d.Total_Frais_Engages ?? 0))
          .query(`INSERT INTO dbo.Bordereaux_Dossiers
                  (BordereauId,Numero_Declaration,Matricule_Employe,Nom_Employe,Prenom_Employe,Montant)
                  VALUES (@bid,@num,@mat,@nom,@pre,@mnt)`);
      }
    }

    // --- Historique SQLite
    if (useSqlite) {
      const info = sql.insertBordereau.run(filename, now.toISOString(), nbDossiers, totalNum, totalNum);
      const bid = info.lastInsertRowid;
      const toStr = (x) => (x == null ? '' : String(x));
      for (const d of dossiers) {
        const numDec = toStr(d["Numéro dossier"] ?? d.Numero_Declaration ?? '');
        const mat    = toStr(d["Matricule"] ?? d.Matricule_Employe ?? d.Matricule_Ste ?? '');
        const nom    = toStr(d.Nom_Employe ?? '');
        const prenom = toStr(d.Prenom_Employe ?? '');
        const mnt    = parseFloat(d["Montant"] ?? d.Montant ?? d.Total_Frais_Engages ?? 0) || 0;
        sql.insertBordereauItem.run(bid, numDec, mat, nom, prenom, mnt);
      }
    }

    res.json({ success: true, filename });
  } catch (err) {
    console.error("❌ Erreur export bordereau :", err);
    res.status(500).json({ error: "Erreur export bordereau" });
  }
});

/* =========================================================
   🗂️ Historique bordereaux (list + détails)
========================================================= */
app.get('/api/bordereaux', async (_req, res) => {
  try {
    if (useMssql) {
      const pool = await getMssqlPool();
      const rows = (await pool.request().query(
        `SELECT Id AS id, filename, date, nbDossiers, total, rembourse
         FROM dbo.Bordereaux ORDER BY date DESC`)).recordset;
      return res.json(rows.map(r => ({
        ...r,
        total: Number(r.total).toFixed(2),
        rembourse: Number(r.rembourse).toFixed(2)
      })));
    }

    if (useSqlite) {
      const list = db.prepare(`
        SELECT Id AS id, filename, date, nbDossiers, total, rembourse
        FROM Bordereaux ORDER BY datetime(date) DESC
      `).all();
      return res.json(list.map(r => ({ ...r, total: Number(r.total).toFixed(2), rembourse: Number(r.rembourse).toFixed(2) })));
    }

    const raw = fs.existsSync(bordereauxHistoryFile) ? fs.readJsonSync(bordereauxHistoryFile) : [];
    const data = raw.map(item => {
      const nb = item.nbDossiers ?? item.nombre ?? (item.dossiers?.length ?? 0);
      const total = parseFloat(item.total || item.dossiers?.reduce((s,d)=>s+parseFloat(d.Total_Frais_Engages||0),0) || 0).toFixed(2);
      const rembourse = item.rembourse ? parseFloat(item.rembourse).toFixed(2) :
        (item.dossiers?.reduce((s,d)=>s+parseFloat(d.Montant_Rembourse||0),0) ?? 0).toFixed(2);
      return { id: item.id, filename: item.filename || '', date: item.date, nbDossiers: nb, total, rembourse };
    });
    res.json(data);
  } catch (err) {
    console.error("Erreur lecture bordereaux:", err);
    res.status(500).json({ error: 'Erreur lecture bordereaux' });
  }
});

app.get('/api/bordereaux/:id/dossiers', async (req, res) => {
  try {
    if (useMssql) {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'Id invalide' });
      const pool = await getMssqlPool();
      const items = (await pool.request().input('id', sqlsrv.Int, id).query(
        `SELECT Numero_Declaration, Matricule_Employe, Nom_Employe, Prenom_Employe, Montant
         FROM dbo.Bordereaux_Dossiers WHERE BordereauId = @id ORDER BY Id`)).recordset;
      return res.json(items);
    }

    if (!useSqlite) return res.status(400).json({ error: 'SQLite désactivé' });
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Id invalide' });
    const items = db.prepare(`
      SELECT Numero_Declaration, Matricule_Employe, Nom_Employe, Prenom_Employe, Montant
      FROM Bordereaux_Dossiers WHERE BordereauId = ? ORDER BY rowid
    `).all(id);
    res.json(items);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/* =========================================================
   🔎 Recherche dossiers depuis la DB — avancée + fallback
========================================================= */
app.get('/api/dossiers/search', async (req, res) => {
  try {
    const qRaw       = String(req.query.q || '').trim();
    const matricule  = String(req.query.matricule || '').trim();
       const typeDecl   = String(req.query.type || '').trim();      // Medical | Dentaire | Optique
    const nature     = String(req.query.nature || '').trim();    // "contient"
    const dateFrom   = String(req.query.dateFrom || '').trim();  // YYYY-MM-DD
    const dateTo     = String(req.query.dateTo || '').trim();
    const montantMin = req.query.montantMin !== undefined && req.query.montantMin !== '' ? Number(req.query.montantMin) : null;
    const montantMax = req.query.montantMax !== undefined && req.query.montantMax !== '' ? Number(req.query.montantMax) : null;

    if (!qRaw && !matricule && !typeDecl && !nature && !dateFrom && !dateTo && montantMin === null && montantMax === null) {
      return res.json([]);
    }

    if (useMssql) {
      const pool = await getMssqlPool();

      const req1 = pool.request();
      const cond1 = [];
      if (qRaw) {
        req1.input('q', sqlsrv.NVarChar(200), `%${qRaw}%`);
        cond1.push(`(
          ISNULL(D.Matricule_Employe,'')   COLLATE Latin1_General_CI_AI LIKE @q COLLATE Latin1_General_CI_AI OR
          ISNULL(D.Nom_Employe,'')         COLLATE Latin1_General_CI_AI LIKE @q COLLATE Latin1_General_CI_AI OR
          ISNULL(D.Prenom_Employe,'')      COLLATE Latin1_General_CI_AI LIKE @q COLLATE Latin1_General_CI_AI OR
          ISNULL(D.Nom_Malade,'')          COLLATE Latin1_General_CI_AI LIKE @q COLLATE Latin1_General_CI_AI OR
          ISNULL(D.Prenom_Malade,'')       COLLATE Latin1_General_CI_AI LIKE @q COLLATE Latin1_General_CI_AI OR
          ISNULL(D.Type_Malade,'')         COLLATE Latin1_General_CI_AI LIKE @q COLLATE Latin1_General_CI_AI OR
          ISNULL(D.Nature_Maladie,'')      COLLATE Latin1_General_CI_AI LIKE @q COLLATE Latin1_General_CI_AI OR
          ISNULL(D.Numero_Declaration,'')  COLLATE Latin1_General_CI_AI LIKE @q COLLATE Latin1_General_CI_AI OR
          CONVERT(varchar(10), D.DateConsultation, 120) LIKE @q
        )`);
      }
      if (matricule)   { req1.input('mat', sqlsrv.NVarChar(50), matricule); cond1.push(`D.Matricule_Employe = @mat`); }
      if (typeDecl)    { req1.input('typ', sqlsrv.NVarChar(50), typeDecl);  cond1.push(`ISNULL(D.Type_Malade,'') COLLATE Latin1_General_CI_AI = @typ COLLATE Latin1_General_CI_AI`); }
      if (nature)      { req1.input('nat', sqlsrv.NVarChar(200), `%${nature}%`); cond1.push(`ISNULL(D.Nature_Maladie,'') COLLATE Latin1_General_CI_AI LIKE @nat COLLATE Latin1_General_CI_AI`); }
      if (dateFrom)    { req1.input('df', sqlsrv.Date, dateFrom); cond1.push(`D.DateConsultation >= @df`); }
      if (dateTo)      { req1.input('dt', sqlsrv.Date, dateTo);   cond1.push(`D.DateConsultation <= @dt`); }
      if (montantMin!==null){ req1.input('mmin', sqlsrv.Decimal(18,2), montantMin); cond1.push(`CAST(D.Montant AS DECIMAL(18,2)) >= @mmin`); }
      if (montantMax!==null){ req1.input('mmax', sqlsrv.Decimal(18,2), montantMax); cond1.push(`CAST(D.Montant AS DECIMAL(18,2)) <= @mmax`); }

      const where1 = cond1.length ? `WHERE ${cond1.join(' AND ')}` : '';
      const rowsD = (await req1.query(`
        SELECT TOP 500
          D.DateConsultation,
          D.Nom_Employe, D.Prenom_Employe,
          D.Nom_Malade, D.Prenom_Malade,
          D.Type_Malade, D.Nature_Maladie,
          D.Matricule_Employe,
          CAST(D.Montant AS DECIMAL(18,2)) AS Montant,
          D.Numero_Declaration,
          B.filename AS fichier
        FROM dbo.Dossiers D
        LEFT JOIN dbo.Bordereaux_Dossiers BD
          ON BD.Numero_Declaration = D.Numero_Declaration
          AND (BD.Matricule_Employe = D.Matricule_Employe OR BD.Matricule_Employe IS NULL)
        LEFT JOIN dbo.Bordereaux B ON B.Id = BD.BordereauId
        ${where1}
        ORDER BY D.DateConsultation DESC, D.Id DESC
      `)).recordset;

      if (rowsD.length || typeDecl || nature) return res.json(rowsD);

      const req2 = pool.request();
      const cond2 = [];
      if (qRaw) {
        req2.input('q', sqlsrv.NVarChar(200), `%${qRaw}%`);
        cond2.push(`(
          ISNULL(BD.Matricule_Employe,'')  COLLATE Latin1_General_CI_AI LIKE @q COLLATE Latin1_General_CI_AI OR
          ISNULL(BD.Numero_Declaration,'') COLLATE Latin1_General_CI_AI LIKE @q COLLATE Latin1_General_CI_AI OR
          ISNULL(BD.Nom_Employe,'')        COLLATE Latin1_General_CI_AI LIKE @q COLLATE Latin1_General_CI_AI OR
          ISNULL(BD.Prenom_Employe,'')     COLLATE Latin1_General_CI_AI LIKE @q COLLATE Latin1_General_CI_AI
        )`);
      }
      if (matricule)   { req2.input('mat', sqlsrv.NVarChar(50), matricule); cond2.push(`BD.Matricule_Employe = @mat`); }
      if (dateFrom)    { req2.input('df', sqlsrv.DateTime2, dateFrom); cond2.push(`CAST(B.date AS date) >= @df`); }
      if (dateTo)      { req2.input('dt', sqlsrv.DateTime2, dateTo);   cond2.push(`CAST(B.date AS date) <= @dt`); }
      if (montantMin!==null){ req2.input('mmin', sqlsrv.Decimal(18,2), montantMin); cond2.push(`CAST(BD.Montant AS DECIMAL(18,2)) >= @mmin`); }
      if (montantMax!==null){ req2.input('mmax', sqlsrv.Decimal(18,2), montantMax); cond2.push(`CAST(BD.Montant AS DECIMAL(18,2)) <= @mmax`); }

      const where2 = cond2.length ? `WHERE ${cond2.join(' AND ')}` : '';
      const rowsBD = (await req2.query(`
        SELECT TOP 500
          CONVERT(varchar(10), B.date, 120) AS DateConsultation,
          BD.Nom_Employe, BD.Prenom_Employe,
          '' AS Nom_Malade, '' AS Prenom_Malade,
          '' AS Type_Malade, '' AS Nature_Maladie,
          BD.Matricule_Employe,
          CAST(BD.Montant AS DECIMAL(18,2)) AS Montant,
          BD.Numero_Declaration,
          B.filename AS fichier
        FROM dbo.Bordereaux_Dossiers BD
        JOIN dbo.Bordereaux B ON B.Id = BD.BordereauId
        ${where2}
        ORDER BY B.date DESC, BD.Id DESC
      `)).recordset;

      return res.json(rowsBD);
    }

    // SQLite
    const cond1 = [];
    const params1 = [];
    if (qRaw) {
      const like = `%${qRaw.toLowerCase()}%`;
      cond1.push(`(
        lower(unaccent(IFNULL(D.Matricule_Employe,'')))  LIKE ? OR
        lower(unaccent(IFNULL(D.Nom_Employe,'')))        LIKE ? OR
        lower(unaccent(IFNULL(D.Prenom_Employe,'')))     LIKE ? OR
        lower(unaccent(IFNULL(D.Nom_Malade,'')))         LIKE ? OR
        lower(unaccent(IFNULL(D.Prenom_Malade,'')))      LIKE ? OR
        lower(unaccent(IFNULL(D.Type_Malade,'')))        LIKE ? OR
        lower(unaccent(IFNULL(D.Nature_Maladie,'')))     LIKE ? OR
        lower(unaccent(IFNULL(D.Numero_Declaration,''))) LIKE ? OR
        lower(unaccent(IFNULL(D.DateConsultation,'')))   LIKE ?
      )`);
      params1.push(like, like, like, like, like, like, like, like, like);
    }
    if (matricule)   { cond1.push(`D.Matricule_Employe = ?`); params1.push(matricule); }
    if (typeDecl)    { cond1.push(`lower(unaccent(IFNULL(D.Type_Malade,''))) = lower(unaccent(?))`); params1.push(typeDecl); }
    if (nature)      { cond1.push(`lower(unaccent(IFNULL(D.Nature_Maladie,''))) LIKE lower(unaccent(?))`); params1.push(`%${nature}%`); }
    if (dateFrom)    { cond1.push(`IFNULL(D.DateConsultation,'') >= ?`); params1.push(dateFrom); }
    if (dateTo)      { cond1.push(`IFNULL(D.DateConsultation,'') <= ?`); params1.push(dateTo); }
    if (montantMin!==null){ cond1.push(`IFNULL(D.Montant,0) >= ?`); params1.push(montantMin); }
    if (montantMax!==null){ cond1.push(`IFNULL(D.Montant,0) <= ?`); params1.push(montantMax); }

    const where1 = cond1.length ? `WHERE ${cond1.join(' AND ')}` : '';
    const rowsD = db.prepare(`
      SELECT
        D.DateConsultation,
        D.Nom_Employe, D.Prenom_Employe,
        D.Nom_Malade, D.Prenom_Malade,
        D.Type_Malade, D.Nature_Maladie,
        D.Matricule_Employe,
        D.Montant,
        D.Numero_Declaration,
        B.filename AS fichier
      FROM Dossiers D
      LEFT JOIN Bordereaux_Dossiers BD
        ON BD.Numero_Declaration = D.Numero_Declaration
        AND (BD.Matricule_Employe = D.Matricule_Employe OR BD.Matricule_Employe IS NULL)
      LEFT JOIN Bordereaux B ON B.Id = BD.BordereauId
      ${where1}
      ORDER BY IFNULL(D.DateConsultation,'') DESC, D.rowid DESC
      LIMIT 500
    `).all(...params1);

    if (rowsD.length || typeDecl || nature) return res.json(rowsD);

    const cond2 = [];
    const params2 = [];
    if (qRaw) {
      const like = `%${qRaw.toLowerCase()}%`;
      cond2.push(`(
        lower(unaccent(IFNULL(BD.Matricule_Employe,'')))  LIKE ? OR
        lower(unaccent(IFNULL(BD.Numero_Declaration,''))) LIKE ? OR
        lower(unaccent(IFNULL(BD.Nom_Employe,'')))        LIKE ? OR
        lower(unaccent(IFNULL(BD.Prenom_Employe,'')))     LIKE ?
      )`);
      params2.push(like, like, like, like);
    }
    if (matricule)   { cond2.push(`BD.Matricule_Employe = ?`); params2.push(matricule); }
    if (dateFrom)    { cond2.push(`date(substr(B.date,1,10)) >= ?`); params2.push(dateFrom); }
    if (dateTo)      { cond2.push(`date(substr(B.date,1,10)) <= ?`); params2.push(dateTo); }
    if (montantMin!==null){ cond2.push(`IFNULL(BD.Montant,0) >= ?`); params2.push(montantMin); }
    if (montantMax!==null){ cond2.push(`IFNULL(BD.Montant,0) <= ?`); params2.push(montantMax); }

    const where2 = cond2.length ? `WHERE ${cond2.join(' AND ')}` : '';
    const rowsBD = db.prepare(`
      SELECT
        substr(B.date,1,10) AS DateConsultation,
        BD.Nom_Employe, BD.Prenom_Employe,
        '' AS Nom_Malade, '' AS Prenom_Malade,
        '' AS Type_Malade, '' AS Nature_Maladie,
        BD.Matricule_Employe,
        BD.Montant,
        BD.Numero_Declaration,
        B.filename AS fichier
      FROM Bordereaux_Dossiers BD
      JOIN Bordereaux B ON B.Id = BD.BordereauId
      ${where2}
      ORDER BY B.date DESC, BD.rowid DESC
      LIMIT 500
    `).all(...params2);

    return res.json(rowsBD);
  } catch (e) {
    console.error('❌ /api/dossiers/search:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Filtre strict par matricule
app.get('/api/dossiers/by-matricule/:mat', async (req, res) => {
  try {
    const mat = String(req.params.mat || '').trim();
    if (!mat) return res.json([]);

    if (useMssql) {
      const pool = await getMssqlPool();
      const rows = (await pool.request()
        .input('m', sqlsrv.NVarChar(50), mat)
        .query(`
          SELECT TOP 200
            D.DateConsultation,
            D.Nom_Employe, D.Prenom_Employe,
            D.Nom_Malade, D.Prenom_Malade,
            D.Type_Malade, D.Nature_Maladie,
            D.Matricule_Employe,
            CAST(D.Montant AS DECIMAL(18,2)) AS Montant,
            D.Numero_Declaration,
            B.filename AS fichier
          FROM dbo.Dossiers D
          LEFT JOIN dbo.Bordereaux_Dossiers BD
            ON BD.Numero_Declaration = D.Numero_Declaration
            AND (BD.Matricule_Employe = D.Matricule_Employe OR BD.Matricule_Employe IS NULL)
          LEFT JOIN dbo.Bordereaux B
            ON B.Id = BD.BordereauId
          WHERE D.Matricule_Employe = @m
          ORDER BY D.DateConsultation DESC, D.Id DESC
        `)).recordset;
      return res.json(rows);
    }

    // SQLite
    const rows = db.prepare(`
      SELECT
        D.DateConsultation,
        D.Nom_Employe, D.Prenom_Employe,
        D.Nom_Malade, D.Prenom_Malade,
        D.Type_Malade, D.Nature_Maladie,
        D.Matricule_Employe,
        D.Montant,
        D.Numero_Declaration,
        B.filename AS fichier
      FROM Dossiers D
      LEFT JOIN Bordereaux_Dossiers BD
        ON BD.Numero_Declaration = D.Numero_Declaration
        AND (BD.Matricule_Employe = D.Matricule_Employe OR BD.Matricule_Employe IS NULL)
      LEFT JOIN Bordereaux B
        ON B.Id = BD.BordereauId
      WHERE D.Matricule_Employe = ?
      ORDER BY IFNULL(D.DateConsultation,'') DESC, D.rowid DESC
      LIMIT 200
    `).all(mat);

    res.json(rows);
  } catch (e) {
    console.error('❌ /api/dossiers/by-matricule:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/* =========================================================
   🔎 Recherche (legacy JSON) — compat
========================================================= */
app.get('/api/dossiers-bordereaux', async (_req, res) => {
  try {
    const fichiers = await fs.readdir(bordereauxDir);
    const fichiersJson = fichiers.filter(f => f.endsWith('.json') && !f.startsWith('~') && f !== 'bordereaux.json');
    let tous = [];
    for (const fichier of fichiersJson) {
      const contenu = await fs.readJson(path.join(bordereauxDir, fichier));
      let ds = Array.isArray(contenu) ? contenu : (Array.isArray(contenu?.dossiers) ? contenu.dossiers : []);
      tous.push(...ds.map(d => ({ ...d, fichier: fichier.replace('.json', '') })));
    }
    res.json(tous);
  } catch (err) {
    console.error("❌ Erreur lecture dossiers bordereaux (legacy):", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =========================================================
   🧰 Routes DEBUG
========================================================= */
app.get('/api/debug/db-tables', async (_req, res) => {
  try {
    if (useMssql) {
      const pool = await getMssqlPool();
      const tables = (await pool.request().query(
        `SELECT name FROM sys.tables ORDER BY name`)).recordset.map(r=>r.name);
      let sampleB = [], sampleI = [], sampleU = [];
      try { sampleB = (await pool.request().query(`SELECT TOP 5 * FROM dbo.Bordereaux ORDER BY date DESC`)).recordset; } catch {}
      try { sampleI = (await pool.request().query(`SELECT TOP 5 * FROM dbo.Bordereaux_Dossiers ORDER BY Id DESC`)).recordset; } catch {}
      try { sampleU = (await pool.request().query(`SELECT TOP 5 Id,username,role,CreatedAt FROM dbo.Users ORDER BY Id DESC`)).recordset; } catch {}
      return res.json({ driver:'mssql', dbName: process.env.MSSQL_DATABASE, tables, sampleB, sampleI, sampleU });
    }
    if (!useSqlite) return res.json({ driver: 'json' });
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name);
    let sampleB=[], sampleI=[], sampleU=[];
    try { sampleB = db.prepare("SELECT * FROM Bordereaux ORDER BY datetime(date) DESC LIMIT 5").all(); } catch {}
    try { sampleI = db.prepare("SELECT * FROM Bordereaux_Dossiers ORDER BY rowid DESC LIMIT 5").all(); } catch {}
    try { sampleU = db.prepare("SELECT Id,username,role,CreatedAt FROM Users ORDER BY Id DESC LIMIT 5").all(); } catch {}
    res.json({ driver:'sqlite', dbPath: path.resolve(process.env.DB_PATH || './data/cosumutuel.db'), tables, sampleB, sampleI, sampleU });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* =========================================================
   ✅ Ping & start
========================================================= */
app.get('/', (_req, res) => res.send(`✅ Backend opérationnel — driver: ${DRIVER}`));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`>>> Backend CosuMutuel démarré sur le port ${PORT}`);
  console.log(`🗄️ Driver: ${DRIVER} ${useSqlite ? `(DB: ${process.env.DB_PATH || 'data/cosumutuel.db'})` : useMssql ? `(DB: ${process.env.MSSQL_DATABASE})` : ''}`);
});
