import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import styles from '../styles/FormPage.module.css';
import OCRScanner from '../components/OCRScanner';

// État initial des champs du formulaire
const INITIAL_FORM_STATE = {
  Numero_Contrat: '',
  Numero_Affiliation: '',
  Matricule_Ste: '',
  Nom_Prenom_Assure: '',
  Type_Declaration: '', // 'Medical', 'Dentaire', 'Optique'
  Total_Frais_Engages: '',
  Date_Consultation: '',
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
  const [selectedEmployee, setSelectedEmployee] = useState(null); // État pour l'employé trouvé
  const [selectedFamilyMember, setSelectedFamilyMember] = useState(''); // Pour l'index de l'enfant ou 'conjoint'

  // Effet pour appliquer la classe du mode sombre au corps du document et sauvegarder la préférence
  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  // Effet pour récupérer les données des employés depuis le backend
  useEffect(() => {
    axios.get('http://localhost:4000/api/employes')
      .then(res => setEmployesData(res.data))
      .catch(err => console.error('Erreur chargement employés :', err));
  }, []);

  /**
   * Calcule l'âge en années à partir d'une chaîne de date de naissance donnée.
   * @param {string} birthDateStr - La chaîne de date de naissance (par exemple, "AAAA-MM-JJ").
   * @returns {number|string} L'âge en années, ou une chaîne vide si birthDateStr est vide.
   */
  const calculateAge = (birthDateStr) => {
    if (!birthDateStr) return '';
    const today = new Date();
    const birthDate = new Date(birthDateStr);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  /**
   * Met à jour les champs du malade en fonction du lien de parenté et de l'employé sélectionné.
   * @param {Object} emp - L'objet employé actuellement sélectionné.
   * @param {string} lienParente - Le lien de parenté sélectionné ('Lui-meme', 'Conjoint', 'Enfants').
   * @param {string} familyMemberKey - La clé/l'index du membre de la famille si 'Enfants' est sélectionné.
   */
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
        ageMalade = calculateAge(selectedChild.dateNaissance); // Note: 'dateNaissance' pour les enfants
      }
    }

    setFormData(prev => ({
      ...prev,
      Nom_Prenom_Malade: `${nomMalade} ${prenomMalade}`.trim(), // Recombine pour le champ unique du formulaire
      Age_Malade: ageMalade,
    }));
  }, [calculateAge]);

  /**
   * Remplit automatiquement les champs du formulaire en fonction des données de l'employé (matricule ou nom).
   * @param {string} field - Le nom du champ ('Matricule_Ste' ou 'Nom_Prenom_Assure') qui a déclenché l'autocomplétion.
   * @param {string} value - La valeur saisie dans le champ.
   */
  const autoFillFromEmploye = useCallback((field, value) => {
    if (!value) {
      setFormData(prev => ({
        ...prev,
        Numero_Contrat: '',
        Numero_Affiliation: '',
        Nom_Prenom_Assure: '',
        Nom_Prenom_Malade: '',
        Age_Malade: '',
        Matricule_Ste: '', // Réinitialiser le matricule si la valeur est vide
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

    setSelectedEmployee(emp); // Mettre à jour l'employé sélectionné

    if (emp) {
      setFormData(prev => {
        const newFormData = {
          ...prev,
          Numero_Contrat: emp.Numero_Contrat || prev.Numero_Contrat || '',
          Numero_Affiliation: emp.Numero_Affiliation || prev.Numero_Affiliation || '',
          Matricule_Ste: emp.Matricule_Employe || '', // Utilise le matricule trouvé
          Nom_Prenom_Assure: `${emp.Nom_Employe || ''} ${emp.Prenom_Employe || ''}`.trim(),
        };
        return newFormData;
      });

      // Appeler updateMaladeFields pour remplir les champs du malade en fonction du lien de parenté actuel
      // Si Lien_Parente n'est pas encore défini, on suppose que c'est l'employé lui-même par défaut
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
      // Si l'employé n'est pas trouvé, effacer uniquement les champs dérivés, pas l'entrée elle-même
      setFormData(prev => ({
        ...prev,
        Numero_Contrat: '',
        Numero_Affiliation: '',
        Nom_Prenom_Assure: field === 'Nom_Prenom_Assure' ? value : '', 
        Nom_Prenom_Malade: '',
        Age_Malade: '',
      }));
      setAlertMessage('');
      setBlockSubmit(false);
      setShowAlertDialog(false);
    }
  }, [employesData, formData.Lien_Parente, selectedFamilyMember, updateMaladeFields, calculateAge]);

  /**
   * Gère les changements dans les champs de saisie du formulaire.
   * @param {Object} e - L'objet événement.
   */
  const handleChange = (e) => {
    const { name, value } = e.target;

    // Logique de remplissage automatique pour Matricule_Ste ou Nom_Prenom_Assure
    if (name === 'Matricule_Ste' || name === 'Nom_Prenom_Assure') {
      setFormData(prev => ({ ...prev, [name]: value })); // Mettre à jour le champ avant d'appeler autoFill
      autoFillFromEmploye(name, value);
    } else if (name === 'Lien_Parente') {
      // Gérer le changement de lien de parenté
      setFormData(prev => ({ ...prev, [name]: value }));
      setSelectedFamilyMember(''); // Réinitialiser la sélection du membre de la famille
      if (selectedEmployee) {
        updateMaladeFields(selectedEmployee, value);
      } else {
        // Si aucun employé n'est sélectionné, vider les champs du malade
        setFormData(prev => ({
          ...prev,
          Nom_Prenom_Malade: '',
          Age_Malade: '',
        }));
      }

      // Re-vérifier l'âge si le lien de parenté est 'Lui-meme'
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
    } else if (name === 'selectedChild') { // Gérer la sélection d'un enfant spécifique
      setSelectedFamilyMember(value);
      if (selectedEmployee) {
        updateMaladeFields(selectedEmployee, 'Enfants', value);
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }

    // Validation pour Date_Consultation (doit être dans les 3 mois)
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

  /**
   * Gère la soumission du formulaire.
   * @param {Object} e - L'objet événement.
   */
  const handleSubmit = (e) => {
    e.preventDefault();

    if (blockSubmit) {
      setAlertMessage(alertMessage || '❌ Formulaire bloqué');
      setShowAlertDialog(true);
      return;
    }

    // Afficher le modal de confirmation avant la soumission finale
    setShowConfirmModal(true);
  };

  /**
   * Confirme la soumission du formulaire après l'interaction de l'utilisateur avec le modal.
   */
  const confirmSubmission = () => {
    setShowConfirmModal(false); // Fermer le modal de confirmation
    console.log('Données soumises:', formData);

    // --- Préparer les données pour l'enregistrement dans localStorage (pour BordereauPage) ---
    const currentFormList = JSON.parse(localStorage.getItem('formList') || '[]');

    // Extraire Nom et Prénom de l'assuré à partir de Nom_Prenom_Assure
    let nomEmploye = '';
    let prenomEmploye = '';
    if (selectedEmployee) {
      nomEmploye = selectedEmployee.Nom_Employe || '';
      prenomEmploye = selectedEmployee.Prenom_Employe || '';
    } else {
      // Fallback si selectedEmployee n'est pas défini (ex: saisie manuelle)
      const parts = formData.Nom_Prenom_Assure.split(' ').filter(Boolean);
      nomEmploye = parts.length > 0 ? parts[0] : '';
      prenomEmploye = parts.slice(1).join(' ') || '';
    }

    // Extraire Nom et Prénom du malade à partir de Nom_Prenom_Malade
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
        // Fallback pour le malade (saisie manuelle ou non trouvé)
        const parts = formData.Nom_Prenom_Malade.split(' ').filter(Boolean);
        nomMalade = parts.length > 0 ? parts[0] : '';
        prenomMalade = parts.slice(1).join(' ') || '';
    }


    const dossierToSave = {
      DateConsultation: formData.Date_Consultation,
      Matricule_Employe: formData.Matricule_Ste,
      Nom_Employe: nomEmploye,
      Prenom_Employe: prenomEmploye,
      Nom_Malade: nomMalade,
      Prenom_Malade: prenomMalade,
      Type_Malade: formData.Type_Declaration, // 'Type_Declaration' du formulaire devient 'Type_Malade' pour la DataTable
      Montant: parseFloat(formData.Total_Frais_Engages || 0).toFixed(2), // Convertir en nombre et fixer les décimales
      Montant_Rembourse: '0.00', // Ce champ n'est pas dans le formulaire, initialisé à 0
      Code_Assurance: '', // Non présent dans le formulaire
      Numero_Declaration: '', // Non présent dans le formulaire
      Ayant_Droit: formData.Lien_Parente, // Utiliser Lien_Parente pour Ayant_Droit
    };

    const updatedFormList = [...currentFormList, dossierToSave];
    localStorage.setItem('formList', JSON.stringify(updatedFormList));

    setAlertMessage('Formulaire envoyé avec succès et dossier ajouté au bordereau !');
    setShowAlertDialog(true);

    // Réinitialiser le formulaire après une soumission réussie
    setFormData(INITIAL_FORM_STATE);
    setBlockSubmit(false);
    setSelectedEmployee(null); // Réinitialiser l'employé sélectionné
    setSelectedFamilyMember(''); // Réinitialiser la sélection du membre de la famille
  };

  /**
   * Fonction pour l'autocomplétion des champs du formulaire via l'OCR.
   * @param {Object} extractedFields - Un objet contenant les champs extraits par l'OCR.
   */
  const handleAutoFillOCR = (extractedFields) => {
    setFormData(prevData => ({
      ...prevData,
      ...extractedFields // Fusionne les champs extraits avec les données actuelles du formulaire
    }));
    // Vous pouvez ajouter ici une logique pour valider ou déclencher d'autres actions après l'autocomplétion
  };

  return (
    <div className={styles.container}>
      {/* Bouton de bascule du mode sombre */}
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

        {/* Section OCR pour le scan de documents */}
        <fieldset className={styles.formSection}>
          <legend className={styles.sectionTitle}>Scan de Document (OCR)</legend>
          <OCRScanner onAutoFill={handleAutoFillOCR} />
        </fieldset>

        {/* Section : Informations sur l'assuré */}
        <fieldset className={styles.formSection}>
          <legend className={styles.sectionTitle}>Informations Assuré</legend>
          <div className={styles.formGroup}>
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

          <div className={styles.formGroup + ' ' + styles.inputGroup}>
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
            <div className={styles.inputFieldHalf}>
              <label htmlFor="Matricule_Ste">Matricule Ste :</label>
              <input
                type="text"
                id="Matricule_Ste"
                name="Matricule_Ste"
                value={formData.Matricule_Ste}
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

        {/* Section : Détails de la déclaration */}
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
              type="number"
              id="Total_Frais_Engages"
              name="Total_Frais_Engages"
              value={formData.Total_Frais_Engages}
              onChange={handleChange}
              className={styles.inputField}
              step="0.01"
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

        {/* Section : Informations sur le malade */}
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

          {/* Champ de sélection pour les enfants, affiché seulement si "Enfants" est sélectionné */}
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
                    {enfant.prenom} {enfant.nom} (Né le {enfant.dateNaissance})
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
              // Rendre le champ en lecture seule si le lien de parenté est géré automatiquement
              readOnly={formData.Lien_Parente === 'Lui-meme' || formData.Lien_Parente === 'Conjoint' || (formData.Lien_Parente === 'Enfants' && selectedFamilyMember !== '')}
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
              className={styles.inputField + ' ' + styles.ageInput}
              // Rendre le champ en lecture seule si le lien de parenté est géré automatiquement
              readOnly={formData.Lien_Parente === 'Lui-meme' || formData.Lien_Parente === 'Conjoint' || (formData.Lien_Parente === 'Enfants' && selectedFamilyMember !== '')}
            />
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

        {/* Affichage du message d'alerte */}
        {showAlertDialog && alertMessage && (
          <div className={styles.alert + ' ' + (blockSubmit ? styles.alertWarning : styles.alertSuccess)}>
            {alertMessage}
          </div>
        )}

        {/* Bouton de soumission */}
        <button
          type="submit"
          disabled={blockSubmit}
          className={styles.submitButton}
        >
          Envoyer
        </button>
      </form>

      {/* Modal de confirmation personnalisé */}
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
