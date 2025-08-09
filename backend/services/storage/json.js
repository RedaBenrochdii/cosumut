// services/storage/json.js
const path = require('path');
const fs = require('fs-extra');

const DATA_DIR = path.join(__dirname, '../../data');
const EMP_FILE = path.join(DATA_DIR, 'employes.json');
const DOS_FILE = path.join(DATA_DIR, 'dossiers.json');

fs.ensureDirSync(DATA_DIR);
if (!fs.existsSync(EMP_FILE)) fs.writeJsonSync(EMP_FILE, [], { spaces: 2 });
if (!fs.existsSync(DOS_FILE)) fs.writeJsonSync(DOS_FILE, [], { spaces: 2 });

// File-based “mutex” via promise chain to serialize writes
let queue = Promise.resolve();
const withLock = (fn) => (queue = queue.then(fn).catch(err => { console.error(err); })).then(() => {});

async function readArray(file) {
  try { return await fs.readJson(file); } catch { return []; }
}
async function writeArray(file, arr) {
  const tmp = file + '.tmp';
  await fs.writeJson(tmp, arr, { spaces: 2 });
  await fs.move(tmp, file, { overwrite: true });
}

const employes = {
  async list() {
    return await readArray(EMP_FILE);
  },
  async get(matricule) {
    const data = await readArray(EMP_FILE);
    const key = String(matricule || '').toLowerCase();
    return data.find(e => String(e.Matricule_Employe || '').toLowerCase() === key) || null;
  },
  async upsert(e) {
    const clean = (v='') => String(v ?? '').trim();
    const obj = {
      Matricule_Employe: clean(e.Matricule_Employe),
      Nom_Employe: clean(e.Nom_Employe),
      Prenom_Employe: clean(e.Prenom_Employe),
      DateNaissance: clean(e.DateNaissance),
      Numero_Contrat: clean(e.Numero_Contrat),
      Numero_Affiliation: clean(e.Numero_Affiliation),
      Famille: Array.isArray(e.Famille) ? e.Famille : undefined
    };
    await withLock(async () => {
      const data = await readArray(EMP_FILE);
      const i = data.findIndex(x => x.Matricule_Employe === obj.Matricule_Employe);
      if (i >= 0) data[i] = { ...data[i], ...obj };
      else data.push(obj);
      await writeArray(EMP_FILE, data);
    });
  }
};

const famille = {
  async add(matricule, member) {
    await withLock(async () => {
      const data = await readArray(EMP_FILE);
      const emp = data.find(e => e.Matricule_Employe === matricule);
      if (!emp) throw new Error('Employé introuvable');
      emp.Famille = emp.Famille || [];
      emp.Famille.push({
        type: (member.type || 'enfant').toLowerCase(),
        nom: member.nom || '',
        prenom: member.prenom || '',
        DateNaissance: member.DateNaissance || member.dateNaissance || ''
      });
      await writeArray(EMP_FILE, data);
    });
  },
  async getConjoint(matricule) {
    const emp = await employes.get(matricule);
    return emp?.Famille?.find(f => f.type === 'conjoint') || null;
  },
  async getEnfants(matricule) {
    const emp = await employes.get(matricule);
    return (emp?.Famille || []).filter(f => f.type === 'enfant');
  }
};

const dossiers = {
  async add(d) {
    const now = new Date().toISOString();
    const record = { ...d, created_at: now, id: Date.now() };
    await withLock(async () => {
      const arr = await readArray(DOS_FILE);
      arr.push(record);
      await writeArray(DOS_FILE, arr);
    });
    return { id: record.id };
  },
  async list() {
    const arr = await readArray(DOS_FILE);
    return arr.sort((a,b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }
};

module.exports = { employes, famille, dossiers };
