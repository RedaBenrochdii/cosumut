// services/storage/index.js
// Choix du driver via .env : STORAGE_DRIVER=sqlite | json
const driver = (process.env.STORAGE_DRIVER || 'json').toLowerCase();

let storage;
try {
  storage = driver === 'sqlite'
    ? require('./sqlite')
    : require('./json');
} catch (e) {
  console.warn('⚠️ Storage driver load failed, fallback to JSON:', e?.message || e);
  storage = require('./json');
}

module.exports = storage;
