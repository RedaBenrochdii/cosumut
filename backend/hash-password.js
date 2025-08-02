const bcrypt = require('bcrypt');
const saltRounds = 10;

// Récupère le mot de passe depuis la ligne de commande
const password = process.argv[2];

if (!password) {
  console.log('Usage: node hash-password.js <mot-de-passe>');
  process.exit(1);
}

bcrypt.hash(password, saltRounds, function(err, hash) {
  if (err) {
    console.error('Erreur de hachage:', err);
    return;
  }
  console.log('Mot de passe original:', password);
  console.log('Hash sécurisé à copier :', hash);
});