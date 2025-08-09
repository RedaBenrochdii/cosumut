// scripts/migrate-json-to-sqlite.js
require('dotenv').config();
process.env.STORAGE_DRIVER = 'sqlite';                 // force sqlite
process.env.DB_PATH = process.env.DB_PATH || './data/cosumutuel.db';

const path = require('path');
const fs = require('fs-extra');
const Database = require('better-sqlite3');

const DB = new Database(process.env.DB_PATH);
DB.pragma('foreign_keys = ON');

// Schéma minimal (idempotent)
DB.exec(`
CREATE TABLE IF NOT EXISTS employes (
  Matricule_Employe   TEXT PRIMARY KEY,
  Nom_Employe         TEXT,
  Prenom_Employe      TEXT,
  DateNaissance       TEXT,
  Numero_Contrat      TEXT,
  Numero_Affiliation  TEXT
);
CREATE TABLE IF NOT EXISTS famille (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  Matricule_Employe   TEXT NOT NULL,
  type TEXT CHECK(type IN ('conjoint','enfant')),
  nom TEXT, prenom TEXT, DateNaissance TEXT,
  FOREIGN KEY (Matricule_Employe) REFERENCES employes(Matricule_Employe) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS dossiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  Numero_Declaration  TEXT,
  Matricule_Employe   TEXT,
  Nom_Employe         TEXT, Prenom_Employe TEXT,
  Nom_Malade          TEXT, Prenom_Malade TEXT,
  Lien_Parente        TEXT CHECK(Lien_Parente IN ('Lui-meme','Conjoint','Enfants') OR Lien_Parente IS NULL),
  Type_Declaration    TEXT CHECK(Type_Declaration IN ('Medical','Dentaire','Optique') OR Type_Declaration IS NULL),
  DateConsultation    TEXT,
  Montant             REAL,
  Montant_Rembourse   REAL DEFAULT 0,
  Numero_Contrat      TEXT,
  Numero_Affiliation  TEXT,
  created_at          TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (Matricule_Employe) REFERENCES employes(Matricule_Employe)
);
`);

const EMP_JSON = path.join(__dirname, '../data/employes.json');
const DOS_JSON = path.join(__dirname, '../data/dossiers.json');

const insEmp = DB.prepare(`
INSERT INTO employes (Matricule_Employe,Nom_Employe,Prenom_Employe,DateNaissance,Numero_Contrat,Numero_Affiliation)
VALUES (@Matricule_Employe,@Nom_Employe,@Prenom_Employe,@DateNaissance,@Numero_Contrat,@Numero_Affiliation)
ON CONFLICT(Matricule_Employe) DO UPDATE SET
  Nom_Employe=excluded.Nom_Employe,
  Prenom_Employe=excluded.Prenom_Employe,
  DateNaissance=excluded.DateNaissance,
  Numero_Contrat=excluded.Numero_Contrat,
  Numero_Affiliation=excluded.Numero_Affiliation
`);
const insFam = DB.prepare(`
INSERT INTO famille (Matricule_Employe,type,nom,prenom,DateNaissance)
VALUES (?,?,?,?,?)
`);
const insDos = DB.prepare(`
INSERT INTO dossiers
(Numero_Declaration,Matricule_Employe,Nom_Employe,Prenom_Employe,Nom_Malade,Prenom_Malade,
 Lien_Parente,Type_Declaration,DateConsultation,Montant,Montant_Rembourse,Numero_Contrat,Numero_Affiliation)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
`);

const tx = DB.transaction((fn) => fn());

function clean(s){ return s==null ? null : String(s).trim(); }
function toNum(v){
  if (v==null || v==='') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function toISO(d){
  if (!d) return null;
  const s = String(d).trim();
  const parts = [
    {re:/^(\d{4})-(\d{2})-(\d{2})$/, fmt:(y,m,dd)=>`${y}-${m}-${dd}`},
    {re:/^(\d{2})\/(\d{2})\/(\d{4})$/, fmt:(dd,m,y)=>`${y}-${m}-${dd}`},
    {re:/^(\d{2})-(\d{2})-(\d{4})$/, fmt:(dd,m,y)=>`${y}-${m}-${dd}`},
  ];
  for (const p of parts){
    const m = s.match(p.re);
    if (m) return p.fmt(m[1],m[2],m[3]);
  }
  return s;
}
function normLien(v){
  const t=(v||'').toLowerCase();
  if (t.includes('conjoint')||t.includes('epoux')||t.includes('époux')||t.includes('épouse')||t.includes('epouse')) return 'Conjoint';
  if (t.includes('enfant')) return 'Enfants';
  if (t.includes('lui')||t.includes('assur')) return 'Lui-meme';
  return null;
}
function normType(v){
  const t=(v||'').toLowerCase();
  if (t.includes('dent')) return 'Dentaire';
  if (t.includes('opt')) return 'Optique';
  if (t.includes('med')) return 'Medical';
  return null;
}

tx(() => {
  // Employés + Famille
  if (fs.existsSync(EMP_JSON)){
    const arr = fs.readJsonSync(EMP_JSON);
    (Array.isArray(arr)?arr:[]).forEach(e=>{
      const mat = clean(e.Matricule_Employe);
      if (!mat) return;
      insEmp.run({
        Matricule_Employe: mat,
        Nom_Employe: clean(e.Nom_Employe),
        Prenom_Employe: clean(e.Prenom_Employe),
        DateNaissance: clean(e.DateNaissance),
        Numero_Contrat: clean(e.Numero_Contrat),
        Numero_Affiliation: clean(e.Numero_Affiliation),
      });
      const fam = Array.isArray(e.Famille)? e.Famille : [];
      fam.forEach(m=>{
        const type = (m.type||'').toLowerCase().includes('conj') ? 'conjoint' : 'enfant';
        insFam.run(mat, type, clean(m.nom||m.Nom), clean(m.prenom||m.Prenom), clean(m.DateNaissance||m.dateNaissance));
      });
    });
  }
  // Dossiers
  if (fs.existsSync(DOS_JSON)){
    let doss = fs.readJsonSync(DOS_JSON);
    if (!Array.isArray(doss) && doss && Array.isArray(doss.dossiers)) doss = doss.dossiers;
    (Array.isArray(doss)?doss:[]).forEach(d=>{
      const g=(...k)=>k.find(x=>d[x]!=null) ? d[k.find(x=>d[x]!=null)] : null;
      insDos.run(
        clean(g('Numero_Declaration','Numéro_Declaration','Numero dossier','Numéro dossier')),
        clean(g('Matricule_Employe','Matricule_Ste','Matricule')),
        clean(g('Nom_Employe','Nom/Prénom','NomEmploye')),
        clean(g('Prenom_Employe','PrenomEmploye')),
        clean(g('Nom_Malade','NomMalade')),
        clean(g('Prenom_Malade','PrenomMalade')),
        normLien(g('Lien_Parente','Ayant_Droit','Lien parenté')),
        normType(g('Type_Declaration','TypeDeclaration')),
        toISO(g('DateConsultation','Date_Consultation')),
        toNum(g('Montant','Total_Frais_Engages')),
        toNum(g('Montant_Rembourse')) ?? 0,
        clean(g('Numero_Contrat','N° Police','Numéro_Contrat')),
        clean(g('Numero_Affiliation','N° Adhésion','Numéro_Affiliation')),
      );
    });
  }
});

const counts = {
  employes: DB.prepare('SELECT COUNT(*) AS n FROM employes').get().n,
  famille:  DB.prepare('SELECT COUNT(*) AS n FROM famille').get().n,
  dossiers: DB.prepare('SELECT COUNT(*) AS n FROM dossiers').get().n,
};
console.log('✅ Migration terminée :', counts);
