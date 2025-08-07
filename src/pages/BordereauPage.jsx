import React, { useEffect, useState } from 'react';
import axios from 'axios';
import styles from '../styles/BordereauPage.module.css'; // Importe les styles dédiés
import { DataTable } from '../components/DataTable';
import DailyConsumptionChart from '../components/DailyConsumptionChart';
// Adresse et objet personnalisables
const TO_EMAIL = "mutuelle@cosumar.co.ma";
const MAIL_SUBJECT = encodeURIComponent("Transmission Bordereau Mutuelle");
const MAIL_BODY = encodeURIComponent(
  `Bonjour,\n\nVeuillez trouver ci-joint le bordereau de transmission généré automatiquement.\nN'oubliez pas de l'attacher en pièce jointe avant d'envoyer.\n\nCordialement,\nService RH`
);

export default function BordereauPage() {
  const [dossiers, setDossiers] = useState([]);
  const [filteredDossiers, setFilteredDossiers] = useState([]);
  const [historique, setHistorique] = useState([]);
  const [filteredHistorique, setFilteredHistorique] = useState([]);
  const [dossiersEmploye, setDossiersEmploye] = useState([]);
  const [allDossiersBordereaux, setAllDossiersBordereaux] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastFilename, setLastFilename] = useState('');
  const [searchHistorique, setSearchHistorique] = useState('');
  const [searchDossiers, setSearchDossiers] = useState('');

  // Effet pour récupérer les dossiers globaux (formList)
  useEffect(() => {
    const data = JSON.parse(localStorage.getItem('formList') || '[]');
    setDossiers(data);
    setFilteredDossiers(data);
  }, []);

  // Effet pour récupérer les bordereaux (pour l'historique des fichiers)
  useEffect(() => {
    axios.get('http://localhost:4000/api/bordereaux')
      .then(res => {
        setHistorique(res.data);
        setFilteredHistorique(res.data);
        if (res.data.length > 0) {
          setLastFilename(res.data[res.data.length - 1].filename || '');
        }
      })
      .catch(() => {
        setHistorique([]);
        setFilteredHistorique([]);
        setMessage('Erreur lors du chargement de l\'historique des bordereaux.');
      });
  }, []);

  // Effet pour récupérer tous les dossiers de tous les bordereaux pour la consommation globale
  useEffect(() => {
    axios.get('http://localhost:4000/api/dossiers-bordereaux')
      .then(res => {
        setAllDossiersBordereaux(res.data);
      })
      .catch(() => {
        setAllDossiersBordereaux([]);
        setMessage('Erreur lors du chargement de la consommation globale.');
      });
  }, []);

  const extractDateFromFilename = filename => {
    if (typeof filename !== 'string') return '';
    const m = filename.match(/bordereau_(\d{4}-\d{2}-\d{2})-/);
    return m ? m[1] : '';
  };

  // Historique recherche
  useEffect(() => {
    const s = searchHistorique.trim().toLowerCase();

    if (!s) {
      setFilteredHistorique(historique);
      setDossiersEmploye([]);
      return;
    }

    setFilteredHistorique(
      historique.filter(b =>
        extractDateFromFilename(b.filename).toLowerCase().includes(s) ||
        (b.filename && b.filename.toLowerCase().includes(s))
      )
    );

    // 🔎 Si champ ressemble à un matricule
    if (/^[a-zA-Z0-9]{3,}$/.test(s)) {
      axios.get('http://localhost:4000/api/dossiers-bordereaux')
        .then(res => {
          const resultats = res.data.filter(d =>
            (d.Matricule_Employe || '').toLowerCase().includes(s)
          );
          setDossiersEmploye(resultats);
        })
        .catch(() => setDossiersEmploye([]));
    } else {
      setDossiersEmploye([]);
    }
  }, [searchHistorique, historique]);

  // Recherche export (formList)
  useEffect(() => {
    if (!searchDossiers) {
      setFilteredDossiers(dossiers);
    } else {
      const s = searchDossiers.toLowerCase();
      setFilteredDossiers(
        dossiers.filter(d =>
          (d.Type_Malade || '').toLowerCase().includes(s) ||
          (d.Matricule_Employe || '').toLowerCase().includes(s) ||
          (d.Nom_Malade || '').toLowerCase().includes(s) ||
          (d.DateConsultation &&
            new Date(d.DateConsultation).toLocaleDateString().toLowerCase().includes(s))
        )
      );
    }
  }, [searchDossiers, dossiers]);

  // --- Regroupe la consommation par date ---
  function computeConsumptionByDate(dossiers) {
    const map = {};
    dossiers.forEach(d => {
      const montant = parseFloat(d.Montant || 0);
      if (!d.DateConsultation) return;
      const date = d.DateConsultation;
      if (!map[date]) map[date] = 0;
      map[date] += isNaN(montant) ? 0 : montant;
    });
    return Object.entries(map).map(([date, Montant]) => ({
      date,
      Montant,
    }));
  }

  // --- Pour affichage ---
  const chartDataGlobal = computeConsumptionByDate(allDossiersBordereaux);
  const chartDataEmploye = computeConsumptionByDate(dossiersEmploye);

  const totalMontant = filteredDossiers
    .reduce((sum, d) => sum + parseFloat(d.Montant || 0), 0)
    .toFixed(2);

  const montantRembourse = filteredDossiers
    .reduce((sum, d) => sum + parseFloat(d.Montant_Rembourse || 0), 0)
    .toFixed(2);

  const parType = filteredDossiers.reduce((acc, d) => {
    const t = d.Type_Malade?.toLowerCase() || 'autre';
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  const getIntervalDate = () => {
    if (!filteredDossiers.length) return '—';
    const dates = filteredDossiers
      .map(d => new Date(d.DateConsultation))
      .filter(d => !isNaN(d));
    if (!dates.length) return '—';
    const min = new Date(Math.min(...dates));
    const max = new Date(Math.max(...dates));
    return `${min.toLocaleDateString()} → ${max.toLocaleDateString()}`;
  };

const exportBordereau = async () => {
  if (!filteredDossiers.length) {
    setMessage('⚠️ Aucun dossier à exporter.');
    return;
  }
  try {
    setLoading(true);
    setMessage('📤 Export en cours...');

    // Mapping automatique vers le format du bordereau Cosumar
const dossiersCosumar = filteredDossiers.map(item => ({
  "N° Police": item.Numero_Contrat || '',
  "N° Adhésion": item.Numero_Affiliation || '',
  "Matricule": item.Matricule_Employe || item.Matricule_Ste || '',
  "Nom/Prénom": (item.Nom_Employe ? item.Nom_Employe : '') + (item.Prenom_Employe ? ' ' + item.Prenom_Employe : ''),
  "Numéro dossier": item.Numero_Declaration || '',
  "Lien parenté": item.Ayant_Droit || item.Lien_Parente || '',
  "Montant": item.Montant || item.Total_Frais_Engages || ''
}));



    // Envoi des dossiers sous forme d'un tableau d'objets
    const res = await axios.post(
      'http://localhost:4000/api/export-bordereau',
      dossiersCosumar, // C'est un tableau d'objets [{...},{...}]
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (res.data.success && res.data.filename) {
      window.open(`http://localhost:4000/bordereaux/${res.data.filename}`, '_blank');
      setMessage('✅ Export réussi.');
      localStorage.setItem('formList', '[]');
      setDossiers([]);
      setFilteredDossiers([]);
      setLastFilename(res.data.filename);
      const updated = await axios.get('http://localhost:4000/api/bordereaux');
      setHistorique(updated.data);
      setFilteredHistorique(updated.data);
    } else {
      setMessage('❌ Erreur lors de la génération du bordereau.');
    }
  } catch (e) {
    setMessage('❌ Erreur serveur.');
  } finally {
    setLoading(false);
  }
};



  const handleDelete = idx => {
    const nd = [...filteredDossiers];
    nd.splice(idx, 1);
    setFilteredDossiers(nd);
    setDossiers(nd);
    setMessage('Dossier supprimé de la liste d\'export. ✅');
  };

  const handleDeleteAll = () => {
    setFilteredDossiers([]);
    setDossiers([]);
    localStorage.setItem('formList', '[]');
    setMessage('Tous les dossiers ont été supprimés de la liste d\'export. ✅');
  };

  const handleEdit = (item, idx) => {
    // Remplacer alert par un modal ou une logique d'édition réelle
    setMessage(`Fonctionnalité d'édition à implémenter pour le dossier : ${item.Nom_Malade} (index ${idx})`);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Bordereau de Transmission</h1>

      {message && (
        <div className={`${styles.alert} ${message.startsWith('✅') ? styles.alertSuccess : message.startsWith('⚠️') ? styles.alertWarning : styles.alertDanger}`}>
          {message}
        </div>
      )}

      {/* Section Résumé du Bordereau */}
      <fieldset className={styles.card}>
        <legend>Résumé du Bordereau Actuel</legend>
        <div className={styles.summaryContent}>
          <p><strong>Nom du fichier :</strong> {lastFilename || '—'}</p>
          <p><strong>Période :</strong> {getIntervalDate()}</p>
          <p><strong>Nombre de dossiers :</strong> {filteredDossiers.length}</p>
          <p><strong>Total Montant :</strong> {totalMontant} MAD</p>
          <p><strong>Montant Remboursé :</strong> {montantRembourse} MAD</p>
          <div style={{ marginTop: '15px' }}>
            <strong>Répartition par type :</strong>
            <ul>
              {Object.entries(parType).map(([type, count]) => (
                <li key={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)} : {count} dossier{count > 1 && 's'}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <button className={`${styles.button} ${styles.primaryButton}`} onClick={exportBordereau} disabled={loading || filteredDossiers.length === 0}>
          {loading ? 'Exportation...' : 'Exporter le Bordereau'}
        </button>
        
      </fieldset>

      {/* Section Dossiers à Exporter */}
      <fieldset className={styles.card}>
        <legend>Dossiers en attente d'exportation</legend>
        <div className={styles.formGroup}>
          <label htmlFor="searchDossiers">Rechercher dans les dossiers à exporter :</label>
          <input
            id="searchDossiers"
            type="text"
            placeholder="Matricule, type ou date..."
            value={searchDossiers}
            onChange={e => setSearchDossiers(e.target.value)}
            className={styles.inputField}
          />
        </div>
        <DataTable
          data={filteredDossiers}
          onDelete={handleDelete}
          onDeleteAll={handleDeleteAll}
          onEdit={handleEdit}
        />
      </fieldset>

      {/* --- Graphique GLOBAL --- */}
      <section className={styles.chartSection}>
        <h2 className={styles.sectionTitle}>Consommation globale (tous les bordereaux)</h2>
        <DailyConsumptionChart data={chartDataGlobal} />
      </section>

      {/* --- Graphique employé (affiché si filtre) --- */}
      {dossiersEmploye.length > 0 && (
        <section className={styles.chartSection}>
          <h2 className={styles.sectionTitle}>
            Consommation de l'employé <span style={{ color: 'var(--primary-blue)' }}>{searchHistorique}</span>
          </h2>
          <DailyConsumptionChart data={chartDataEmploye} />
        </section>
      )}

      {/* Section Historique des Bordereaux */}
      <fieldset className={styles.card}>
        <legend>Historique des Bordereaux</legend>
        <div className={styles.formGroup}>
          <label htmlFor="searchHistorique">Rechercher dans l'historique (nom du fichier ou matricule) :</label>
          <input
            id="searchHistorique"
            type="text"
            placeholder="Nom du fichier ou matricule..."
            value={searchHistorique}
            onChange={e => setSearchHistorique(e.target.value)}
            className={styles.inputField}
          />
        </div>
        
        {/* Historique des fichiers */}
        {filteredHistorique.length > 0 && (
          <div className={styles.tableContainer}>
            <h3 className={styles.subSectionTitle}>Fichiers de Bordereaux :</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Fichier</th>
                  <th>Date</th>
                  <th>Nb Dossiers</th>
                  <th>Total (MAD)</th>
                  <th>Remboursé (MAD)</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistorique.map((b, i) => (
                  <tr key={i}>
                    <td>
                      <a
                        href={`http://localhost:4000/bordereaux/${b.filename}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {b.filename}
                      </a>
                    </td>
                    <td>{new Date(b.date).toLocaleString()}</td>
                    <td>{b.nbDossiers}</td>
                    <td>{parseFloat(b.total || 0).toFixed(2)}</td>
                    <td>{parseFloat(b.rembourse || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Résultats des dossiers par matricule */}
        {dossiersEmploye.length > 0 && (
          <div className={styles.tableContainer}>
            <h3 className={styles.subSectionTitle}>
              Dossiers trouvés pour le matricule <span style={{ color: 'var(--primary-blue)' }}>{searchHistorique}</span> :
            </h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Nom Employé</th>
                  <th>Nom Malade</th>
                  <th>Type</th>
                  <th>Montant</th>
                  <th>Bordereau</th>
                </tr>
              </thead>
              <tbody>
                {dossiersEmploye.map((d, i) => (
                  <tr key={i}>
                    <td>{d.DateConsultation}</td>
                    <td>{d.Nom_Employe}</td>
                    <td>{d.Nom_Malade}</td>
                    <td>{d.Type_Malade}</td>
                    <td>{d.Montant}</td>
                    <td>
                      <a
                        href={`http://localhost:4000/bordereaux/${d.fichier}.xlsx`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {d.fichier}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </fieldset>
    </div>
  );
}