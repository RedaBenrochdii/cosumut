// services/storage/sqlite.js
const path = require('path');
const fs = require('fs-extra');
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/cosumutuel.db');
fs.ensureDirSync(path.dirname(dbPath));

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS employes (
  Matricule_Employe   TEXT PRIMARY KEY,
  Nom_Employe         TEXT,
  Prenom_Employe      TEXT,
  DateNaissance       TEXT,
  Numero_Contrat      TEXT,
  Numero_Affiliation  TEXT
);

CREATE TABLE IF NOT EXISTS famille (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  Matricule_Employe   TEXT NOT NULL,
  type                TEXT CHECK(type IN ('conjoint','enfant')),
  nom                 TEXT,
  prenom              TEXT,
  DateNaissance       TEXT,
  FOREIGN KEY (Matricule_Employe) REFERENCES employes(Matricule_Employe) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dossiers (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  Numero_Declaration  TEXT,
  Matricule_Employe   TEXT,
  Nom_Employe         TEXT,
  Prenom_Employe      TEXT,
  Nom_Malade          TEXT,
  Prenom_Malade       TEXT,
  Lien_Parente        TEXT CHECK(Lien_Parente IN ('Lui-meme','Conjoint','Enfants')),
  Type_Declaration    TEXT CHECK(Type_Declaration IN ('Medical','Dentaire','Optique')),
  DateConsultation    TEXT,
  Montant             REAL,
  Montant_Rembourse   REAL DEFAULT 0,
  Numero_Contrat      TEXT,
  Numero_Affiliation  TEXT,
  created_at          TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (Matricule_Employe) REFERENCES employes(Matricule_Employe)
);

CREATE INDEX IF NOT EXISTS idx_dossiers_matricule ON dossiers(Matricule_Employe);
CREATE INDEX IF NOT EXISTS idx_dossiers_numdec   ON dossiers(Numero_Declaration);
`);

const employes = {
  list() {
    return db.prepare(`SELECT * FROM employes ORDER BY Nom_Employe, Prenom_Employe`).all();
  },
  get(matricule) {
    return db.prepare(`SELECT * FROM employes WHERE Matricule_Employe = ?`).get(matricule);
  },
  upsert(e) {
    const clean = (v='') => String(v ?? '').trim();
    const obj = {
      Matricule_Employe: clean(e.Matricule_Employe),
      Nom_Employe: clean(e.Nom_Employe),
      Prenom_Employe: clean(e.Prenom_Employe),
      DateNaissance: clean(e.DateNaissance),
      Numero_Contrat: clean(e.Numero_Contrat),
      Numero_Affiliation: clean(e.Numero_Affiliation),
    };
    db.prepare(`
      INSERT INTO employes (Matricule_Employe,Nom_Employe,Prenom_Employe,DateNaissance,Numero_Contrat,Numero_Affiliation)
      VALUES (@Matricule_Employe,@Nom_Employe,@Prenom_Employe,@DateNaissance,@Numero_Contrat,@Numero_Affiliation)
      ON CONFLICT(Matricule_Employe) DO UPDATE SET
        Nom_Employe=excluded.Nom_Employe,
        Prenom_Employe=excluded.Prenom_Employe,
        DateNaissance=excluded.DateNaissance,
        Numero_Contrat=excluded.Numero_Contrat,
        Numero_Affiliation=excluded.Numero_Affiliation
    `).run(obj);
  }
};

const famille = {
  add(matricule, member) {
    const type = String(member.type || '').toLowerCase();
    const okType = type === 'conjoint' || type === 'enfant' ? type : 'enfant';
    return db.prepare(`
      INSERT INTO famille (Matricule_Employe,type,nom,prenom,DateNaissance)
      VALUES (?,?,?,?,?)
    `).run(
      String(matricule),
      okType,
      String(member.nom || ''),
      String(member.prenom || ''),
      member.DateNaissance || member.dateNaissance || null
    );
  },
  getConjoint(matricule) {
    return db.prepare(`SELECT * FROM famille WHERE Matricule_Employe=? AND type='conjoint'`).get(matricule);
  },
  getEnfants(matricule) {
    return db.prepare(`SELECT * FROM famille WHERE Matricule_Employe=? AND type='enfant' ORDER BY DateNaissance`).all(matricule);
  }
};

const dossiers = {
  add(d) {
    const clean = (v='') => String(v ?? '').trim();
    const num = (x) => (x === null || x === undefined || x === '' ? null : Number(x));
    const obj = {
      Numero_Declaration: clean(d.Numero_Declaration),
      Matricule_Employe: clean(d.Matricule_Employe),
      Nom_Employe: clean(d.Nom_Employe),
      Prenom_Employe: clean(d.Prenom_Employe),
      Nom_Malade: clean(d.Nom_Malade),
      Prenom_Malade: clean(d.Prenom_Malade),
      Lien_Parente: clean(d.Lien_Parente),
      Type_Declaration: clean(d.Type_Declaration),
      DateConsultation: clean(d.DateConsultation),
      Montant: num(d.Montant ?? d.Total_Frais_Engages),
      Montant_Rembourse: num(d.Montant_Rembourse),
      Numero_Contrat: clean(d.Numero_Contrat),
      Numero_Affiliation: clean(d.Numero_Affiliation),
    };
    const r = db.prepare(`
      INSERT INTO dossiers
      (Numero_Declaration, Matricule_Employe, Nom_Employe, Prenom_Employe,
       Nom_Malade, Prenom_Malade, Lien_Parente, Type_Declaration, DateConsultation,
       Montant, Montant_Rembourse, Numero_Contrat, Numero_Affiliation)
      VALUES (@Numero_Declaration,@Matricule_Employe,@Nom_Employe,@Prenom_Employe,
              @Nom_Malade,@Prenom_Malade,@Lien_Parente,@Type_Declaration,@DateConsultation,
              @Montant,@Montant_Rembourse,@Numero_Contrat,@Numero_Affiliation)
    `).run(obj);
    return { id: r.lastInsertRowid };
  },
  list() {
    return db.prepare(`SELECT * FROM dossiers ORDER BY created_at DESC, id DESC`).all();
  }
};

module.exports = { employes, famille, dossiers };
