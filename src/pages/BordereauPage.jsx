// src/pages/BordereauPage.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import styles from '../styles/BordereauPage.module.css';
import { DataTable } from '../components/DataTable';
import DailyConsumptionChart from '../components/DailyConsumptionChart';

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

  // 🔎 Filtres avancés (panneau)
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [fMatricule, setFMatricule] = useState('');
  const [fType, setFType] = useState(''); // Medical, Dentaire, Optique
  const [fNature, setFNature] = useState('');
  const [fDateFrom, setFDateFrom] = useState('');
  const [fDateTo, setFDateTo] = useState('');
  const [fMontantMin, setFMontantMin] = useState('');
  const [fMontantMax, setFMontantMax] = useState('');

  // Debounce timer pour la recherche DB
  const dbSearchTimer = useRef(null);

  // ✅ helper: recharge la liste depuis localStorage
  const reloadFormList = () => {
    const data = JSON.parse(localStorage.getItem('formList') || '[]');
    setDossiers(data);
    setFilteredDossiers(data);
  };

  // ✅ Migration one-shot: garantit la clé Nature_Maladie sur anciens items
  useEffect(() => {
    try {
      const raw = localStorage.getItem('formList');
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      let updated = false;
      const out = arr.map(it => (it && typeof it === 'object' && typeof it.Nature_Maladie === 'undefined')
        ? (updated = true, { ...it, Nature_Maladie: '' })
        : it
      );
      if (updated) localStorage.setItem('formList', JSON.stringify(out));
    } catch {}
  }, []);

  // 📥 charge + écoute les mises à jour
  useEffect(() => {
    reloadFormList(); // initial
    const onLocalUpdate = () => reloadFormList();
    const onStorage = (e) => { if (e.key === 'formList') reloadFormList(); };
    const onVisible = () => { if (!document.hidden) reloadFormList(); };
    window.addEventListener('formList:updated', onLocalUpdate);
    window.addEventListener('focus', onLocalUpdate);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('formList:updated', onLocalUpdate);
      window.removeEventListener('focus', onLocalUpdate);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Historique des bordereaux (fichiers)
  useEffect(() => {
    axios.get('http://localhost:4000/api/bordereaux')
      .then(res => {
        const arr = Array.isArray(res.data) ? res.data : [];
        setHistorique(arr);
        setFilteredHistorique(arr);
        if (arr.length) setLastFilename(arr[0]?.filename || arr[arr.length - 1]?.filename || '');
      })
      .catch(() => {
        setHistorique([]);
        setFilteredHistorique([]);
        setMessage('Erreur lors du chargement de l\'historique des bordereaux.');
      });
  }, []);

  // Tous les dossiers (legacy JSON) pour graphe global
  useEffect(() => {
    axios.get('http://localhost:4000/api/dossiers-bordereaux')
      .then(res => setAllDossiersBordereaux(Array.isArray(res.data) ? res.data : []))
      .catch(() => {
        setAllDossiersBordereaux([]);
        setMessage('Erreur lors du chargement de la consommation globale.');
      });
  }, []);

  const extractDateFromFilename = (filename) => {
    if (typeof filename !== 'string') return '';
    const m = filename.match(/bordereau_(\d{4}-\d{2}-\d{2})-/);
    return m ? m[1] : '';
  };

  // 🔎 Recherche historique fichiers + dossiers (DB) avec filtres avancés
  useEffect(() => {
    const s = searchHistorique.trim();

    // Filtrer la liste des fichiers (UI)
    if (!s) {
      setFilteredHistorique(historique);
    } else {
      const sLow = s.toLowerCase();
      setFilteredHistorique(
        historique.filter(b =>
          extractDateFromFilename(b.filename).toLowerCase().includes(sLow) ||
          (b.filename && b.filename.toLowerCase().includes(sLow))
        )
      );
    }

    // Debounce 300ms pour requête DB
    if (dbSearchTimer.current) clearTimeout(dbSearchTimer.current);
    dbSearchTimer.current = setTimeout(() => {
      const params = {};
      if (s) params.q = s;
      if (fMatricule) params.matricule = fMatricule;
      if (fType) params.type = fType;
      if (fNature) params.nature = fNature;
      if (fDateFrom) params.dateFrom = fDateFrom;
      if (fDateTo) params.dateTo = fDateTo;
      if (fMontantMin) params.montantMin = fMontantMin;
      if (fMontantMax) params.montantMax = fMontantMax;

      // si aucun critère => on n’interroge pas
      if (Object.keys(params).length === 0) { setDossiersEmploye([]); return; }

      axios.get('http://localhost:4000/api/dossiers/search', { params })
        .then(res => setDossiersEmploye(Array.isArray(res.data) ? res.data : []))
        .catch(() => setDossiersEmploye([]));
    }, 300);

    return () => {
      if (dbSearchTimer.current) clearTimeout(dbSearchTimer.current);
    };
  }, [searchHistorique, historique, fMatricule, fType, fNature, fDateFrom, fDateTo, fMontantMin, fMontantMax]);

  // 🔎 Recherche locale sur la liste à exporter (inclut Nature_Maladie)
  useEffect(() => {
    if (!searchDossiers) {
      setFilteredDossiers(dossiers);
    } else {
      const s = searchDossiers.toLowerCase();
      setFilteredDossiers(
        dossiers.filter(d =>
          (d.Type_Malade || '').toLowerCase().includes(s) ||
          ((d.Matricule_Employe || d.Matricule_Ste || '') + '').toLowerCase().includes(s) ||
          (d.Nom_Malade || '').toLowerCase().includes(s) ||
          (d.Nature_Maladie || '').toLowerCase().includes(s) ||
          (d.DateConsultation && new Date(d.DateConsultation).toLocaleDateString().toLowerCase().includes(s))
        )
      );
    }
  }, [searchDossiers, dossiers]);

  // --- Regroupe la consommation par date ---
  function computeConsumptionByDate(ds) {
    const map = {};
    ds.forEach(d => {
      const montant = parseFloat(d.Montant ?? d.Total_Frais_Engages ?? 0);
      if (!d.DateConsultation) return;
      const date = d.DateConsultation;
      if (!map[date]) map[date] = 0;
      map[date] += isNaN(montant) ? 0 : montant;
    });
    return Object.entries(map).map(([date, Montant]) => ({ date, Montant }));
  }

  const totalMontant = useMemo(() =>
    filteredDossiers.reduce((sum, d) => sum + (parseFloat(d.Montant ?? d.Total_Frais_Engages ?? 0) || 0), 0).toFixed(2),
  [filteredDossiers]);

  const montantRembourse = useMemo(() =>
    filteredDossiers.reduce((sum, d) => sum + (parseFloat(d.Montant_Rembourse || 0) || 0), 0).toFixed(2),
  [filteredDossiers]);

  const parType = useMemo(() =>
    filteredDossiers.reduce((acc, d) => {
      const t = d.Type_Malade?.toLowerCase() || 'autre';
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {}),
  [filteredDossiers]);

  const getIntervalDate = () => {
    if (!filteredDossiers.length) return '—';
    const dates = filteredDossiers.map(d => new Date(d.DateConsultation)).filter(d => !isNaN(d));
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

      const dossiersCosumar = filteredDossiers.map(item => ({
        "N° Police": item.Numero_Contrat || '',
        "N° Adhésion": item.Numero_Affiliation || '',
        "Matricule": item.Matricule_Employe || item.Matricule_Ste || '',
        "Nom/Prénom": (item.Nom_Employe ? item.Nom_Employe : '') + (item.Prenom_Employe ? ' ' + item.Prenom_Employe : ''),
        "Numéro dossier": item.Numero_Declaration || '',
        "Lien parenté": item.Ayant_Droit || item.Lien_Parente || '',
        "Montant": item.Montant || item.Total_Frais_Engages || ''
      }));

      const res = await axios.post(
        'http://localhost:4000/api/export-bordereau',
        dossiersCosumar,
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (res.data.success && res.data.filename) {
        window.open(`http://localhost:4000/bordereaux/${res.data.filename}`, '_blank');
        setMessage('✅ Export réussi.');
        localStorage.setItem('formList', '[]');
        reloadFormList();
        setLastFilename(res.data.filename);
        const updated = await axios.get('http://localhost:4000/api/bordereaux');
        setHistorique(updated.data);
        setFilteredHistorique(updated.data);
      } else {
        setMessage('❌ Erreur lors de la génération du bordereau.');
      }
    } catch {
      setMessage('❌ Erreur serveur.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (idx) => {
    const nd = [...filteredDossiers];
    nd.splice(idx, 1);
    setFilteredDossiers(nd);
    setDossiers(nd);
    localStorage.setItem('formList', JSON.stringify(nd));
    setMessage('Dossier supprimé de la liste d\'export. ✅');
  };

  const handleDeleteAll = () => {
    setFilteredDossiers([]);
    setDossiers([]);
    localStorage.setItem('formList', '[]');
    setMessage('Tous les dossiers ont été supprimés de la liste d\'export. ✅');
  };

  const handleEdit = (item, idx) => {
    setMessage(`Fonctionnalité d'édition à implémenter pour le dossier : ${item.Nom_Malade} (index ${idx})`);
  };

  const applyAdvancedFilters = () => {
    // force un rafraîchissement immédiat sans attendre le debounce
    if (dbSearchTimer.current) clearTimeout(dbSearchTimer.current);
    const params = {};
    if (searchHistorique.trim()) params.q = searchHistorique.trim();
    if (fMatricule) params.matricule = fMatricule;
    if (fType) params.type = fType;
    if (fNature) params.nature = fNature;
    if (fDateFrom) params.dateFrom = fDateFrom;
    if (fDateTo) params.dateTo = fDateTo;
    if (fMontantMin) params.montantMin = fMontantMin;
    if (fMontantMax) params.montantMax = fMontantMax;

    if (Object.keys(params).length === 0) { setDossiersEmploye([]); return; }

    axios.get('http://localhost:4000/api/dossiers/search', { params })
      .then(res => setDossiersEmploye(Array.isArray(res.data) ? res.data : []))
      .catch(() => setDossiersEmploye([]));
  };

  const resetAdvancedFilters = () => {
    setFMatricule('');
    setFType('');
    setFNature('');
    setFDateFrom('');
    setFDateTo('');
    setFMontantMin('');
    setFMontantMax('');
    setDossiersEmploye([]);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Bordereau de Transmission</h1>

      {message && (
        <div className={`${styles.alert} ${message.startsWith('✅') ? styles.alertSuccess : message.startsWith('⚠️') ? styles.alertWarning : styles.alertDanger}`}>
          {message}
        </div>
      )}

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
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button className={`${styles.button} ${styles.primaryButton}`} onClick={exportBordereau} disabled={loading || filteredDossiers.length === 0}>
              {loading ? 'Exportation...' : 'Exporter le Bordereau'}
            </button>
            <button
              className={`${styles.button} ${styles.secondaryButton}`}
              onClick={() => {
                window.open(
                  `https://mail.google.com/mail/?view=cm&fs=1&to=${TO_EMAIL}&su=${MAIL_SUBJECT}&body=${MAIL_BODY}`,
                  '_blank'
                );
              }}
              disabled={filteredDossiers.length === 0}
            >
              Envoyer à Wafa
            </button>
          </div>
      </fieldset>

      <fieldset className={styles.card}>
        <legend>Dossiers en attente d'exportation</legend>
        <div className={styles.formGroup}>
          <label htmlFor="searchDossiers">Rechercher dans les dossiers à exporter :</label>
          <input
            id="searchDossiers"
            type="text"
            placeholder="Matricule, type, nature (grippe, diabète) ou date..."
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

      <section className={styles.chartSection}>
        <h2 className={styles.sectionTitle}>Consommation globale (tous les bordereaux)</h2>
        <DailyConsumptionChart data={computeConsumptionByDate(allDossiersBordereaux)} />
      </section>

      {dossiersEmploye.length > 0 && (
        <section className={styles.chartSection}>
          <h2 className={styles.sectionTitle}>
            Résultats (DB){searchHistorique.trim() ? <> pour « <span style={{ color: 'var(--primary-blue)' }}>{searchHistorique}</span> »</> : null}
          </h2>
          <DailyConsumptionChart data={computeConsumptionByDate(dossiersEmploye)} />
        </section>
      )}

      <fieldset className={styles.card}>
        <legend>Historique des Bordereaux</legend>

        {/* Barre de recherche + icône filtre */}
        <div className={styles.formGroup} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="searchHistorique">Rechercher (fichier, matricule, nature, etc.) :</label>
            <input
              id="searchHistorique"
              type="text"
              placeholder="Nom de fichier, matricule (ex: 8888), nature (ex: grippe)…"
              value={searchHistorique}
              onChange={e => setSearchHistorique(e.target.value)}
              className={styles.inputField}
            />
          </div>

          <button
            type="button"
            onClick={() => setIsFiltersOpen(v => !v)}
            title="Recherche avancée"
            aria-label="Recherche avancée"
            style={{
              border: '1px solid var(--border-color, #ddd)',
              background: 'var(--card-bg, #fff)',
              borderRadius: 8,
              height: 40,
              width: 40,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer'
            }}
          >
            {/* Icône entonnoir (inline SVG) */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M3 5a1 1 0 0 1 1-1h16a1 1 0 0 1 .8 1.6l-6.2 8.27V19a1 1 0 0 1-1.45.9l-3-1.5A1 1 0 0 1 10 17v-2.13L3.2 5.6A1 1 0 0 1 3 5z"/>
            </svg>
          </button>
        </div>

        {/* Panneau de filtres avancés */}
        {isFiltersOpen && (
          <div
            style={{
              border: '1px solid var(--border-color, #e5e7eb)',
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
              background: 'var(--card-bg, #fff)'
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 12 }}>
              <div>
                <label>Matricule</label>
                <input
                  type="text"
                  value={fMatricule}
                  onChange={e => setFMatricule(e.target.value)}
                  className={styles.inputField}
                  placeholder="ex: 8888"
                />
              </div>
              <div>
                <label>Type</label>
                <select
                  value={fType}
                  onChange={e => setFType(e.target.value)}
                  className={styles.inputField}
                >
                  <option value="">— Tous —</option>
                  <option value="Medical">Médical</option>
                  <option value="Dentaire">Dentaire</option>
                  <option value="Optique">Optique</option>
                </select>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label>Nature contient</label>
                <input
                  type="text"
                  value={fNature}
                  onChange={e => setFNature(e.target.value)}
                  className={styles.inputField}
                  placeholder="ex: grippe, diabète…"
                />
              </div>
              <div>
                <label>Du</label>
                <input
                  type="date"
                  value={fDateFrom}
                  onChange={e => setFDateFrom(e.target.value)}
                  className={styles.inputField}
                />
              </div>
              <div>
                <label>Au</label>
                <input
                  type="date"
                  value={fDateTo}
                  onChange={e => setFDateTo(e.target.value)}
                  className={styles.inputField}
                />
              </div>
              <div>
                <label>Montant min</label>
                <input
                  type="number"
                  value={fMontantMin}
                  onChange={e => setFMontantMin(e.target.value)}
                  className={styles.inputField}
                />
              </div>
              <div>
                <label>Montant max</label>
                <input
                  type="number"
                  value={fMontantMax}
                  onChange={e => setFMontantMax(e.target.value)}
                  className={styles.inputField}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" className={styles.primaryButton} onClick={applyAdvancedFilters}>
                Appliquer
              </button>
              <button type="button" className={styles.button} onClick={resetAdvancedFilters}>
                Réinitialiser
              </button>
            </div>
          </div>
        )}

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
                      <a href={`http://localhost:4000/bordereaux/${b.filename}`} target="_blank" rel="noreferrer">
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

        {dossiersEmploye.length > 0 && (
          <div className={styles.tableContainer}>
            <h3 className={styles.subSectionTitle}>Dossiers trouvés (base de données) :</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Nom Employé</th>
                  <th>Nom Malade</th>
                  <th>Type</th>
                  <th>Nature</th>
                  <th>Montant</th>
                  <th>Bordereau</th>
                </tr>
              </thead>
              <tbody>
                {dossiersEmploye.map((d, i) => (
                  <tr key={i}>
                    {/* 🛠️ Correction: Formatage de la date */}
                    <td>{d.DateConsultation ? new Date(d.DateConsultation).toLocaleDateString() : '—'}</td>
                    <td>{[d.Nom_Employe, d.Prenom_Employe].filter(Boolean).join(' ') || '—'}</td>
                    <td>{[d.Nom_Malade, d.Prenom_Malade].filter(Boolean).join(' ') || '—'}</td>
                    <td>{d.Type_Malade || '—'}</td>
                    <td>{d.Nature_Maladie || '—'}</td>
                    <td>{(d.Montant ?? '') !== '' ? Number(d.Montant).toFixed(2) : '—'}</td>
                    <td>
                      {d.fichier
                        ? <a href={`http://localhost:4000/bordereaux/${d.fichier}.xlsx`} target="_blank" rel="noreferrer">{d.fichier}</a>
                        : '—'}
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