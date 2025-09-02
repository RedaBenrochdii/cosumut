// src/pages/FormPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import styles from '../styles/FormPage.module.css';
import OCRAnonymizer from "../components/OCRAnonymizer";

// ⚠️ NE PAS utiliser process.env avec Vite
const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE)
  || 'http://localhost:4000';

const api = axios.create({ baseURL: API_BASE });

const AGE_LIMIT = 25; // ✅ Seuil d’alerte visuelle pour les ENFANTS

// État initial des champs du formulaire
const INITIAL_FORM_STATE = {
  Numero_Contrat: '',
  Numero_Affiliation: '',
  Matricule_Ste: '',
  Nom_Prenom_Assure: '',
  Type_Declaration: '', // 'Medical', 'Dentaire', 'Optique'
  Total_Frais_Engages: '',
  Date_Consultation: '',
  Numero_Declaration: '',
  Nom_Prenom_Malade: '',
  Age_Malade: '',
  Lien_Parente: '', // 'Lui-meme', 'Conjoint', 'Enfants'
  Nature_Maladie: ''
};

export default function FormPage() {
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [employesData, setEmployesData] = useState([]);
  const [alertMessage, setAlertMessage] = useState('');
  const [blockSubmit, setBlockSubmit] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedFamilyMember, setSelectedFamilyMember] = useState('');
  const [submitting, setSubmitting] = useState(false); // 👈 anti double-clic
  const [ocrEngine, setOcrEngine] = useState('gemini'); // 'gemini', 'paddle', 'tesseract'

  /* =========================
     UI: Dark Mode
  ========================== */
  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  /* =========================
     Charger employés (API)
  ========================== */
  useEffect(() => {
    api.get('/api/employes')
      .then(res => setEmployesData(res.data))
      .catch(err => console.error('Erreur chargement employés :', err));
  }, []);

  /* =========================
     Helpers
  ========================== */
  const calculateAge = useCallback((birthDateStr) => {
    if (!birthDateStr) return '';
    const birthDate = new Date(birthDateStr);
    if (Number.isNaN(birthDate.getTime())) return '';
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }, []);

  const updateMaladeFields = useCallback((emp, lienParente, familyMemberKey = '') => {
    let nomMalade = '';
    let prenomMalade = '';
    let ageMalade = '';

    if (!emp) {
      setFormData(prev => ({
        ...prev,
        Nom_Prenom_Malade: '',
        Age_Malade: '',
      }));
      return;
    }

    if (lienParente === 'Lui-meme') {
      nomMalade = emp.Nom_Employe || '';
      prenomMalade = emp.Prenom_Employe || '';
      ageMalade = calculateAge(emp.DateNaissance);
    } else if (lienParente === 'Conjoint') {
      const conjoint = emp.Famille?.find(f => f.type === 'conjoint');
      if (conjoint) {
        nomMalade = conjoint.nom || '';
        prenomMalade = conjoint.prenom || '';
        ageMalade = calculateAge(conjoint.DateNaissance);
      }
    } else if (lienParente === 'Enfants') {
      const enfants = emp.Famille?.filter(f => f.type === 'enfant') || [];
      const selectedChild = enfants[parseInt(familyMemberKey)];
      if (selectedChild) {
        nomMalade = selectedChild.nom || '';
        prenomMalade = selectedChild.prenom || '';
        const dn = selectedChild.dateNaissance || selectedChild.DateNaissance;
        ageMalade = calculateAge(dn);
      }
    }

    setFormData(prev => ({
      ...prev,
      Nom_Prenom_Malade: `${nomMalade} ${prenomMalade}`.trim(),
      Age_Malade: ageMalade,
    }));
  }, [calculateAge]);

  const autoFillFromEmploye = useCallback((field, value) => {
    if (!value) {
      setFormData(prev => ({
        ...prev,
        Numero_Contrat: '',
        Numero_Affiliation: '',
        Nom_Prenom_Assure: '',
        Nom_Prenom_Malade: '',
        Age_Malade: '',
        Matricule_Ste: '',
      }));
      setSelectedEmployee(null);
      setSelectedFamilyMember('');
      setAlertMessage('');
      setBlockSubmit(false);
      setShowAlertDialog(false);
      return;
    }

    let emp = null;
    if (field === 'Matricule_Ste') {
      emp = employesData.find(e => e.Matricule_Employe?.toLowerCase() === value.toLowerCase());
    } else if (field === 'Nom_Prenom_Assure') {
      emp = employesData.find(e => {
        const fullName = `${e.Nom_Employe || ''} ${e.Prenom_Employe || ''}`.trim();
        return fullName.toLowerCase() === value.toLowerCase();
      });
    }

    setSelectedEmployee(emp);

    if (emp) {
      setFormData(prev => ({
        ...prev,
        Numero_Contrat: emp.Numero_Contrat || prev.Numero_Contrat || '',
        Numero_Affiliation: emp.Numero_Affiliation || prev.Numero_Affiliation || '',
        Matricule_Ste: emp.Matricule_Employe || '',
        Nom_Prenom_Assure: `${emp.Nom_Employe || ''} ${emp.Prenom_Employe || ''}`.trim(),
      }));

      updateMaladeFields(emp, formData.Lien_Parente || 'Lui-meme', selectedFamilyMember);

      const age = calculateAge(emp.DateNaissance);
      if (age >= 60 && (formData.Lien_Parente === 'Lui-meme' || !formData.Lien_Parente)) {
        setAlertMessage(`❌ Employé trop âgé : ${age} ans (limite = 60 ans)`);
        setBlockSubmit(true);
        setShowAlertDialog(true);
      } else {
        setAlertMessage('');
        setBlockSubmit(false);
        setShowAlertDialog(false);
      }
    } else {
      setFormData(prev => ({
        ...prev,
        Numero_Contrat: '',
        Numero_Affiliation: '',
        Nom_Prenom_Malade: '',
        Age_Malade: '',
      }));
      setAlertMessage('');
      setBlockSubmit(false);
      setShowAlertDialog(false);
    }
  }, [employesData, formData.Lien_Parente, selectedFamilyMember, updateMaladeFields, calculateAge]);

  /* =========================
     Handlers formulaire
  ========================== */
  const handleChange = (e) => {
    const { name, value } = e.target;

    const evaluateExpression = (expression) => {
      try {
        const sanitizedExpression = expression.replace(/[^0-9+\-*/.]/g, '');
        // eslint-disable-next-line no-new-func
        const result = new Function('return ' + sanitizedExpression)();
        return Number.isFinite(result) ? result.toString() : value;
      } catch {
        return value;
      }
    };

    if (name === 'Total_Frais_Engages') {
      const calculatedValue = evaluateExpression(value);
      setFormData(prev => ({ ...prev, [name]: calculatedValue }));
    } else if (name === 'Matricule_Ste' || name === 'Nom_Prenom_Assure') {
      setFormData(prev => ({ ...prev, [name]: value }));
      autoFillFromEmploye(name, value);
    } else if (name === 'Lien_Parente') {
      setFormData(prev => ({ ...prev, [name]: value }));
      setSelectedFamilyMember('');
      if (selectedEmployee) {
        updateMaladeFields(selectedEmployee, value);
      } else {
        setFormData(prev => ({ ...prev, Nom_Prenom_Malade: '', Age_Malade: '' }));
      }
      if (value === 'Lui-meme' && selectedEmployee) {
        const age = calculateAge(selectedEmployee.DateNaissance);
        if (age >= 60) {
          setAlertMessage(`❌ Employé trop âgé : ${age} ans (limite = 60 ans)`);
          setBlockSubmit(true);
          setShowAlertDialog(true);
        } else {
          setAlertMessage('');
          setBlockSubmit(false);
          setShowAlertDialog(false);
        }
      } else {
        setAlertMessage('');
        setBlockSubmit(false);
        setShowAlertDialog(false);
      }
    } else if (name === 'selectedChild') {
      setSelectedFamilyMember(value);
      if (selectedEmployee) {
        updateMaladeFields(selectedEmployee, 'Enfants', value);
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    if (name === 'Date_Consultation') {
      if (value) {
        const dateInput = new Date(value);
        const today = new Date();
        const diffDays = (today - dateInput) / (1000 * 60 * 60 * 24);
        if (diffDays > 90) {
          setAlertMessage('⚠️ La date de consultation dépasse 3 mois.');
          setBlockSubmit(true);
          setShowAlertDialog(true);
          return;
        }
      }
      setAlertMessage('');
      setBlockSubmit(false);
      setShowAlertDialog(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (blockSubmit) {
      setAlertMessage(alertMessage || '❌ Formulaire bloqué');
      setShowAlertDialog(true);
      return;
    }

    setShowConfirmModal(true);
  };

  /* =========================
     Soumission → API / DB + localStorage
  ========================== */
  const confirmSubmission = async () => {
    setShowConfirmModal(false);
    if (submitting) return;
    setSubmitting(true);

    const currentFormList = JSON.parse(localStorage.getItem('formList') || '[]');

    // Reconstitue nom/prénom employé
    let nomEmploye = '';
    let prenomEmploye = '';
    if (selectedEmployee) {
      nomEmploye = selectedEmployee.Nom_Employe || '';
      prenomEmploye = selectedEmployee.Prenom_Employe || '';
    } else {
      const parts = formData.Nom_Prenom_Assure.split(' ').filter(Boolean);
      nomEmploye = parts.length > 0 ? parts[0] : '';
      prenomEmploye = parts.slice(1).join(' ') || '';
    }

    // Reconstitue nom/prénom malade
    let nomMalade = '';
    let prenomMalade = '';
    if (formData.Lien_Parente === 'Lui-meme' && selectedEmployee) {
      nomMalade = selectedEmployee.Nom_Employe || '';
      prenomMalade = selectedEmployee.Prenom_Employe || '';
    } else if (formData.Lien_Parente === 'Conjoint' && selectedEmployee) {
      const conjoint = selectedEmployee.Famille?.find(f => f.type === 'conjoint');
      if (conjoint) {
        nomMalade = conjoint.nom || '';
        prenomMalade = conjoint.prenom || '';
      }
    } else if (formData.Lien_Parente === 'Enfants' && selectedEmployee && selectedFamilyMember !== '') {
      const enfants = selectedEmployee.Famille?.filter(f => f.type === 'enfant') || [];
      const selectedChild = enfants[parseInt(selectedFamilyMember)];
      if (selectedChild) {
        nomMalade = selectedChild.nom || '';
        prenomMalade = selectedChild.prenom || '';
      }
    } else {
      const parts = formData.Nom_Prenom_Malade.split(' ').filter(Boolean);
      nomMalade = parts.length > 0 ? parts[0] : '';
      prenomMalade = parts.slice(1).join(' ') || '';
    }

    // Payload envoyé au backend (inclut Nature_Maladie)
    const dossierToSave = {
      DateConsultation: formData.Date_Consultation || null,
      Numero_Contrat: formData.Numero_Contrat || null,
      Numero_Affiliation: formData.Numero_Affiliation || null,
      Matricule_Employe: formData.Matricule_Ste || null,
      Nom_Employe: nomEmploye || null,
      Prenom_Employe: prenomEmploye || null,
      Nom_Malade: nomMalade || null,
      Prenom_Malade: prenomMalade || null,
      Type_Malade: formData.Type_Declaration || null,
      Nature_Maladie: (formData.Nature_Maladie || '').trim(),
      Montant: Number.parseFloat(formData.Total_Frais_Engages || 0) || 0,
      Montant_Rembourse: 0,
      Code_Assurance: '',
      Numero_Declaration: formData.Numero_Declaration || null,
      Ayant_Droit: formData.Lien_Parente || null,
    };

    try {
      // 🔗 1) Enregistrement DB
      const res = await api.post('/api/dossiers', dossierToSave);
      if (!res.data?.success) throw new Error('Réponse inattendue');

      // 💾 2) Ajout au bordereau local (utilisé par BordereauPage)
      const updatedFormList = [...currentFormList, dossierToSave];
      localStorage.setItem('formList', JSON.stringify(updatedFormList));

      // 🔔 3) Notifier les autres vues (BordereauPage peut écouter cet event)
      window.dispatchEvent(new CustomEvent('formList:updated', { detail: { count: updatedFormList.length } }));

      setAlertMessage('✅ Dossier enregistré et ajouté au bordereau.');
      setShowAlertDialog(true);

      // reset du formulaire
      setFormData(INITIAL_FORM_STATE);
      setBlockSubmit(false);
      setSelectedEmployee(null);
      setSelectedFamilyMember('');
    } catch (e) {
      console.error(e);
      setAlertMessage("❌ Échec d'enregistrement en base. Vérifie que le serveur tourne et que STORAGE_DRIVER=sqlite (ou MSSQL).");
      setShowAlertDialog(true);
    } finally {
      setSubmitting(false);
    }
  };

  /* =========================
     Helpers OCR (Gemini)
  ========================== */
  const toInputDate = (s='') => {
    const m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
    if (!m) return s;
    const jj = m[1].padStart(2,'0');
    const mm = m[2].padStart(2,'0');
    const aaaa = m[3];
    return `${aaaa}-${mm}-${jj}`;
  };
  const normalizeLien = (s='') => {
    const t = s.toLowerCase();
    if (t.includes('lui')) return 'Lui-meme';
    if (t.includes('conjoint')) return 'Conjoint';
    if (t.includes('enfant')) return 'Enfants';
    return '';
  };
  const extractNumeroDeclaration = (obj = {}) => {
    const cands = [
      obj.Numero_Declaration,
      obj["Numéro dossier"],
      obj.numero_dossier,
      obj.numeroDossier,
      obj.DeclarationHeader,
      obj.Top_Declaration,
      obj.declaration_header,
      obj.declaration_en_tete,
    ];
    for (const v of cands) {
      if (!v) continue;
      const m = String(v).match(/\d{6,}/); // 6+ chiffres
      if (m) return m[0];
    }
    const all = Object.values(obj).filter(v => typeof v === "string").join(" | ");
    const m = all.match(/declar\w*\s+de\s+mala\w*\s*:\s*([0-9]{6,})/i);
    return m ? m[1] : "";
  };

  // ⚡ Appelé automatiquement après anonymisation + OCR Gemini
  const handleAutoFillOCR = (extracted) => {
    const patch = { ...extracted };

    if (patch.Date_Consultation) {
      patch.Date_Consultation = toInputDate(patch.Date_Consultation);
    }
    if (patch.Lien_Parente) {
      patch.Lien_Parente = normalizeLien(patch.Lien_Parente);
    }
    if (!patch.Numero_Declaration) {
      patch.Numero_Declaration = extractNumeroDeclaration(extracted);
    }

    setFormData(prev => ({ ...prev, ...patch }));

    const matricule = patch.Matricule_Ste?.trim();
    const nomAssure = patch.Nom_Prenom_Assure?.trim();
    if (matricule) {
      autoFillFromEmploye('Matricule_Ste', matricule);
    } else if (nomAssure) {
      autoFillFromEmploye('Nom_Prenom_Assure', nomAssure);
    }
  };

  /* =========================
     Déductions UI
  ========================== */
  const isChildOverOrAt25 =
    String(formData.Lien_Parente) === 'Enfants' &&
    Number(formData.Age_Malade) >= AGE_LIMIT;

  /* =========================
     Render
  ========================== */
  return (
    <div className={styles.container}>
      <div className={styles.darkModeToggle}>
        <button
          onClick={() => setDarkMode(!darkMode)}
          className={styles.darkModeButton}
        >
          {darkMode ? '☀️ Mode clair' : '🌙 Mode sombre'}
        </button>
      </div>

      <h1 className={styles.formTitle}>Déclaration de Maladie</h1>

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* 1) Scan + anonymisation + OCR (choix moteur) */}
        <fieldset className={styles.formSection}>
          <legend className={styles.sectionTitle}>Scan de Document (OCR)</legend>
          <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
            <label htmlFor="ocrEngine">Moteur OCR :</label>
            <select
              id="ocrEngine"
              name="ocrEngine"
              value={ocrEngine}
              onChange={e => setOcrEngine(e.target.value)}
              className={styles.inputField}
              style={{ maxWidth: 200 }}
            >
              <option value="gemini">Gemini (IA Google)</option>
              <option value="paddle">PaddleOCR (local)</option>
              <option value="tesseract">Tesseract.js (local)</option>
            </select>
          </div>
          <OCRAnonymizer onAutoExtract={handleAutoFillOCR} ocrEngine={ocrEngine} />
        </fieldset>

        {/* 2) Numéro du Dossier */}
        <fieldset className={styles.formSection}>
          <legend className={styles.sectionTitle}>Numéro du Dossier</legend>
          <div className={styles.formGroup}>
            <label htmlFor="Numero_Declaration">Numéro du dossier :</label>
            <input
              type="text"
              id="Numero_Declaration"
              name="Numero_Declaration"
              value={formData.Numero_Declaration}
              onChange={handleChange}
              className={styles.inputField}
            />
          </div>
        </fieldset>

        {/* 3) Informations Assuré */}
        <fieldset className={styles.formSection}>
          <legend className={styles.sectionTitle}>Informations Assuré</legend>

          {/* Matricule en premier */}
          <div className={styles.formGroup}>
            <label htmlFor="Matricule_Ste">Matricule Ste :</label>
            <input
              type="text"
              id="Matricule_Ste"
              name="Matricule_Ste"
              value={formData.Matricule_Ste}
              onChange={handleChange}
              className={styles.inputField}
              autoFocus
            />
          </div>

          {/* N° du contrat + N° affiliation */}
          <div className={styles.formGroup + ' ' + styles.inputGroup}>
            <div className={styles.inputFieldHalf}>
              <label htmlFor="Numero_Contrat">N° du contrat :</label>
              <input
                type="text"
                id="Numero_Contrat"
                name="Numero_Contrat"
                value={formData.Numero_Contrat}
                onChange={handleChange}
                className={styles.inputField}
              />
            </div>
            <div className={styles.inputFieldHalf}>
              <label htmlFor="Numero_Affiliation">N° affiliation :</label>
              <input
                type="text"
                id="Numero_Affiliation"
                name="Numero_Affiliation"
                value={formData.Numero_Affiliation}
                onChange={handleChange}
                className={styles.inputField}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="Nom_Prenom_Assure">Nom et prénom de l'assuré :</label>
            <input
              type="text"
              id="Nom_Prenom_Assure"
              name="Nom_Prenom_Assure"
              value={formData.Nom_Prenom_Assure}
              onChange={handleChange}
              className={styles.inputField}
            />
          </div>
        </fieldset>

        {/* 4) Détails déclaration */}
        <fieldset className={styles.formSection}>
          <legend className={styles.sectionTitle}>Détails de la Déclaration</legend>
          <div className={styles.formGroup}>
            <label>Type de déclaration :</label>
            <div className={styles.radioGroup}>
              {['Medical', 'Dentaire', 'Optique'].map(type => (
                <label key={type} className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="Type_Declaration"
                    value={type}
                    checked={formData.Type_Declaration === type}
                    onChange={handleChange}
                    className={styles.radioInput}
                  />
                  {type === 'Medical' ? 'Médical' : type === 'Dentaire' ? 'Dentaire' : 'Optique'}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="Total_Frais_Engages">Total des frais engagés :</label>
            <input
              type="text"
              id="Total_Frais_Engages"
              name="Total_Frais_Engages"
              value={formData.Total_Frais_Engages}
              onChange={handleChange}
              className={styles.inputField}
              placeholder="ex: 120+80.5*2"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="Date_Consultation">Date de la consultation :</label>
            <input
              type="date"
              id="Date_Consultation"
              name="Date_Consultation"
              value={formData.Date_Consultation}
              onChange={handleChange}
              className={styles.inputField}
            />
          </div>
        </fieldset>

        {/* 5) Informations Malade */}
        <fieldset className={styles.formSection}>
          <legend className={styles.sectionTitle}>Informations Malade</legend>
          <div className={styles.formGroup}>
            <label>Lien de parenté :</label>
            <div className={styles.radioGroup}>
              {['Lui-meme', 'Conjoint', 'Enfants'].map(lien => (
                <label key={lien} className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="Lien_Parente"
                    value={lien}
                    checked={formData.Lien_Parente === lien}
                    onChange={handleChange}
                    className={styles.radioInput}
                  />
                  {lien === 'Lui-meme' ? 'Lui-même' : lien === 'Conjoint' ? 'Conjoint' : 'Enfants'}
                </label>
              ))}
            </div>
          </div>

          {formData.Lien_Parente === 'Enfants' && selectedEmployee && selectedEmployee.Famille && (
            <div className={styles.formGroup}>
              <label htmlFor="selectedChild">Sélectionner un enfant :</label>
              <select
                id="selectedChild"
                name="selectedChild"
                value={selectedFamilyMember}
                onChange={handleChange}
                className={styles.inputField}
              >
                <option value="">-- Choisir un enfant --</option>
                {selectedEmployee.Famille.filter(f => f.type === 'enfant').map((enfant, index) => (
                  <option key={index} value={index}>
                    {enfant.prenom} {enfant.nom} (Né le {enfant.dateNaissance || enfant.DateNaissance || '—'})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="Nom_Prenom_Malade">Nom et prénom du malade :</label>
            <input
              type="text"
              id="Nom_Prenom_Malade"
              name="Nom_Prenom_Malade"
              value={formData.Nom_Prenom_Malade}
              onChange={handleChange}
              className={styles.inputField}
              readOnly={
                formData.Lien_Parente === 'Lui-meme' ||
                formData.Lien_Parente === 'Conjoint' ||
                (formData.Lien_Parente === 'Enfants' && selectedFamilyMember !== '')
              }
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="Age_Malade">Âge :</label>
            <input
              type="number"
              id="Age_Malade"
              name="Age_Malade"
              value={formData.Age_Malade}
              onChange={handleChange}
              min={0}
              aria-invalid={isChildOverOrAt25 ? 'true' : 'false'}
              className={[
                styles.inputField,
                styles.ageInput,
                isChildOverOrAt25 ? styles.inputError : ''
              ].join(' ').trim()}
              readOnly={
                formData.Lien_Parente === 'Lui-meme' ||
                formData.Lien_Parente === 'Conjoint' ||
                (formData.Lien_Parente === 'Enfants' && selectedFamilyMember !== '')
              }
            />
            {isChildOverOrAt25 && (
              <div className={styles.inlineWarning}>Âge ≥ {AGE_LIMIT} — vérifier l’éligibilité.</div>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="Nature_Maladie">Nature de la maladie :</label>
            <textarea
              id="Nature_Maladie"
              name="Nature_Maladie"
              value={formData.Nature_Maladie}
              onChange={handleChange}
              rows={3}
              className={styles.textareaField}
            />
          </div>
        </fieldset>

        {showAlertDialog && alertMessage && (
          <div className={styles.alert + ' ' + (blockSubmit ? styles.alertWarning : styles.alertSuccess)}>
            {alertMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={blockSubmit || submitting}
          className={styles.submitButton}
          title={submitting ? 'Envoi en cours...' : 'Envoyer'}
        >
          {submitting ? 'Envoi...' : 'Envoyer'}
        </button>
      </form>

      {showConfirmModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>Confirmer la soumission</h2>
            <p className={styles.modalMessage}>Êtes-vous sûr de vouloir envoyer ce formulaire ?</p>
            <div className={styles.modalActions}>
              <button
                onClick={() => setShowConfirmModal(false)}
                className={styles.cancelButton}
              >
                Annuler
              </button>
              <button
                onClick={confirmSubmission}
                className={styles.confirmButton}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
