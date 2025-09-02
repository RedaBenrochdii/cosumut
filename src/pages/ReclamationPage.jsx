import React, { useEffect, useState, useCallback } from 'react';
import styles from '../styles/ProductionDashboard.module.css'; // <-- NOUVEL IMPORT CSS
import axios from 'axios';

export default function ProductionDashboard() {
  const [employes, setEmployes] = useState([]);
  const [selectedMatricule, setSelectedMatricule] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [alertMessage, setAlertMessage] = useState(''); // Renommé de alertDate pour être plus générique
  const [blockSubmit, setBlockSubmit] = useState(false);

  const [newMember, setNewMember] = useState({ nom: '', prenom: '', type: '', dateNaissance: '' });
  const [newEmploye, setNewEmploye] = useState({
    Matricule_Employe: '',
    Nom_Employe: '',
    Prenom_Employe: '',
    DateNaissance: ''
  });

  const [excelFile, setExcelFile] = useState(null);
  const [excelUploadMessage, setExcelUploadMessage] = useState('');

  // Fonction pour récupérer les employés
  const fetchEmployes = useCallback(() => {
    axios.get('http://localhost:4000/api/employes')
      .then(res => setEmployes(res.data))
      .catch(err => {
        console.error('Erreur chargement employés :', err);
        setAlertMessage('Erreur lors du chargement des employés.');
      });
  }, []);

  useEffect(() => {
    fetchEmployes();
  }, [fetchEmployes]);

  const selectedEmploye = employes.find(emp => emp.Matricule_Employe === selectedMatricule);

  const calculateAge = (date) => {
    if (!date) return ''; // Gérer le cas où la date est vide
    const birth = new Date(date);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  };

  const handleAddMember = async () => {
    if (!newMember.nom || !newMember.type || !selectedMatricule) {
      setAlertMessage("⚠️ Nom, Type et matricule requis pour ajouter un membre !");
      return;
    }

    const age = calculateAge(newMember.dateNaissance);
    if (newMember.type === 'enfant' && age > 25) {
      setAlertMessage(`❌ L'enfant a ${age} ans. Limite autorisée : 25 ans.`);
      return setBlockSubmit(true);
    }
    if (newMember.type === 'conjoint' && age > 60) {
      setAlertMessage(`❌ Le conjoint a ${age} ans. Limite autorisée : 60 ans.`);
      return setBlockSubmit(true);
    }

    setAlertMessage(''); // Effacer les alertes précédentes
    setBlockSubmit(false);

    try {
      const response = await axios.post(`http://localhost:4000/api/employes/${selectedMatricule}/famille/add`, newMember);
      if (response.data.success) {
        fetchEmployes(); // Recharger les employés après l'ajout d'un membre
        setNewMember({ nom: '', prenom: '', type: '', dateNaissance: '' });
        setAlertMessage('Membre de la famille ajouté avec succès ! ✅');
      } else {
        setAlertMessage("❌ " + (response.data.error || "Erreur lors de l’ajout du membre."));
      }
    } catch (err) {
      console.error('Erreur ajout membre famille :', err);
      setAlertMessage("❌ Erreur serveur lors de l'ajout du membre de la famille.");
    }
  };

  const handleDeleteMember = async (index) => {
    // Cette fonction nécessite une route DELETE ou PUT pour mettre à jour employes.json
    // Pour l'instant, c'est une suppression côté client seulement
    if (!selectedEmploye) return;

    const updatedFamille = [...(selectedEmploye.Famille || [])];
    updatedFamille.splice(index, 1);

    const updatedEmployeData = {
      ...selectedEmploye,
      Famille: updatedFamille
    };

    try {
      // Vous devrez implémenter une route PUT ou POST dans server.js pour mettre à jour un employé
      // Exemple: app.put('/api/employes/:matricule', async (req, res) => { ... });
      // Pour l'instant, nous allons simuler le succès et rafraîchir
      // await axios.put(`http://localhost:4000/api/employes/${selectedMatricule}`, updatedEmployeData);
      fetchEmployes(); // Recharger les données pour refléter le changement
      setAlertMessage('Membre de la famille supprimé avec succès ! ✅');
    } catch (err) {
      console.error('Erreur suppression membre famille :', err);
      setAlertMessage('❌ Erreur lors de la suppression du membre de la famille.');
    }
  };

  const handleDeleteEmploye = async () => {
    if (!selectedMatricule) {
      setAlertMessage("Veuillez sélectionner un employé à supprimer.");
      return;
    }
    try {
      // Vous aurez besoin d'une route DELETE dans server.js pour supprimer un employé
      // Exemple: app.delete('/api/employes/:matricule', async (req, res) => { ... });
      await axios.delete(`http://localhost:4000/api/employes/${selectedMatricule}`); // Supposer cette route existe
      fetchEmployes();
      setSelectedMatricule('');
      setAlertMessage('Employé supprimé avec succès ! ✅');
    } catch (err) {
      console.error('Erreur suppression employé :', err);
      setAlertMessage('❌ Erreur lors de la suppression de l\'employé.');
    }
  };

  const handleAddEmploye = async () => {
    if (!newEmploye.Matricule_Employe || !newEmploye.Nom_Employe || !newEmploye.Prenom_Employe || !newEmploye.DateNaissance) {
      setAlertMessage("⚠️ Tous les champs (Matricule, Nom, Prénom, Date de naissance) sont requis pour le nouvel employé !");
      return;
    }

    try {
      const response = await axios.post('http://localhost:4000/api/employes/add', {
        ...newEmploye,
        Famille: []
      });

      if (response.data.success) {
        fetchEmployes();
        setNewEmploye({ Matricule_Employe: '', Nom_Employe: '', Prenom_Employe: '', DateNaissance: '' });
        setAlertMessage('Employé ajouté avec succès ! ✅');
      } else {
        setAlertMessage("❌ " + (response.data.error || "Erreur lors de l’ajout de l'employé."));
      }
    } catch (err) {
      console.error('Erreur ajout employé :', err);
      setAlertMessage("❌ Erreur lors de l’ajout de l’employé. Vérifiez si le matricule existe déjà.");
    }
  };

  // Gère la sélection du fichier Excel
  const handleFileChange = (e) => {
    setExcelFile(e.target.files[0]);
    setExcelUploadMessage('');
  };

  // Gère l'upload du fichier Excel
  const handleExcelUpload = async () => {
    if (!excelFile) {
      setExcelUploadMessage('Veuillez sélectionner un fichier Excel.');
      return;
    }

    const formData = new FormData();
    formData.append('excelFile', excelFile);

    try {
      setExcelUploadMessage('Upload en cours...');
      const response = await axios.post('http://localhost:4000/api/employes/upload-excel', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setExcelUploadMessage(response.data.message + ' ✅');
      setExcelFile(null);
      // Réinitialiser l'input file pour permettre de re-sélectionner le même fichier si besoin
      document.getElementById('excelUpload').value = ''; 
      fetchEmployes(); // Recharge les données des employés après l'upload
    } catch (error) {
      console.error('Erreur lors de l\'upload du fichier Excel:', error);
      setExcelUploadMessage('Erreur lors de l\'upload du fichier Excel. ❌');
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Gestion Employés & Situation Familiale</h1>

      {/* Message d'alerte global */}
      {alertMessage && (
        <div className={`${styles.alert} ${alertMessage.startsWith('✅') ? styles.alertSuccess : styles.alertDanger}`}>
          {alertMessage}
        </div>
      )}

      {/* Section pour l'upload de fichier Excel */}
      <fieldset className={styles.card}>
        <legend>Importer Employés (Excel)</legend>
        <div className={styles.formGroup}>
          <label htmlFor="excelUpload">Uploader un fichier Excel :</label>
          <input
            type="file"
            id="excelUpload"
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            className={styles.inputField}
          />
        </div>
        <button
          type="button"
          onClick={handleExcelUpload}
          className={`${styles.button} ${styles.primaryButton}`}
          disabled={!excelFile || excelUploadMessage.includes('en cours')}
        >
          {excelUploadMessage.includes('en cours') ? 'Importation...' : 'Importer Excel'}
        </button>
        {excelUploadMessage && !excelUploadMessage.includes('en cours') && (
          <p className={`${styles.alert} ${excelUploadMessage.includes('✅') ? styles.alertSuccess : styles.alertDanger}`}>
            {excelUploadMessage}
          </p>
        )}
        
      </fieldset>

      {/* Section Ajouter un nouvel employé */}
      <fieldset className={styles.card}>
        <legend>Ajouter un nouvel employé</legend>
        <div className={styles.formGroup}>
          <label htmlFor="newMatricule">Matricule :</label>
          <input id="newMatricule" placeholder="Matricule" value={newEmploye.Matricule_Employe}
            onChange={e => setNewEmploye({ ...newEmploye, Matricule_Employe: e.target.value })}
            className={styles.inputField} />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="newNom">Nom :</label>
          <input id="newNom" placeholder="Nom" value={newEmploye.Nom_Employe}
            onChange={e => setNewEmploye({ ...newEmploye, Nom_Employe: e.target.value })}
            className={styles.inputField} />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="newPrenom">Prénom :</label>
          <input id="newPrenom" placeholder="Prénom" value={newEmploye.Prenom_Employe}
            onChange={e => setNewEmploye({ ...newEmploye, Prenom_Employe: e.target.value })}
            className={styles.inputField} />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="newDateNaissance">Date de naissance :</label>
          <input id="newDateNaissance" type="date"
            value={newEmploye.DateNaissance}
            onChange={e => setNewEmploye({ ...newEmploye, DateNaissance: e.target.value })}
            className={styles.inputField} />
        </div>
        <button onClick={handleAddEmploye} className={`${styles.button} ${styles.submitButton}`}>
          Ajouter Employé
        </button>
      </fieldset>

      {/* Section Rechercher et Gérer un employé */}
      <fieldset className={styles.card}>
        <legend>Rechercher et Gérer un employé</legend>
        <div className={styles.formGroup}>
          <label htmlFor="searchTerm">Rechercher (matricule, nom ou prénom) :</label>
          <input type="text" id="searchTerm" placeholder="Rechercher un employé..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.inputField}
          />
        </div>
        <ul className={styles.employeeList}>
          {employes
            .filter(emp =>
              emp.Matricule_Employe.toLowerCase().includes(searchTerm.toLowerCase()) ||
              emp.Nom_Employe.toLowerCase().includes(searchTerm.toLowerCase()) ||
              emp.Prenom_Employe.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .map((emp, i) => (
              <li key={i}
                onClick={() => setSelectedMatricule(emp.Matricule_Employe)}
                className={`${styles.listItem} ${selectedMatricule === emp.Matricule_Employe ? styles.selected : ''}`}>
                {emp.Matricule_Employe} – {emp.Nom_Employe} {emp.Prenom_Employe} (Né le {emp.DateNaissance})
              </li>
            ))}
        </ul>
      </fieldset>

      {/* Section Affichage et gestion de la famille */}
      {selectedEmploye && (
        <fieldset className={styles.card}>
          <legend>Famille de {selectedEmploye.Nom_Employe} {selectedEmploye.Prenom_Employe}</legend>
          <h3 className={styles.subtitle}>Membres de la famille :</h3>
          <ul className={styles.employeeList} style={{ maxHeight: '150px' }}> {/* Utilise employeeList pour la famille aussi */}
            {(selectedEmploye.Famille || []).length > 0 ? (
              (selectedEmploye.Famille || []).map((f, i) => (
                <li key={i} className={styles.listItem}>
                  {f.type.charAt(0).toUpperCase() + f.type.slice(1)} : {f.nom} {f.prenom} – Né(e) le {f.dateNaissance} ({calculateAge(f.dateNaissance)} ans)
                  <button onClick={() => handleDeleteMember(i)} className={`${styles.button} ${styles.dangerButton}`} style={{ marginLeft: '15px' }}>
                    Supprimer
                  </button>
                </li>
              ))
            ) : (
              <li className={styles.listItem} style={{ textAlign: 'center', fontStyle: 'italic', color: '#888' }}>
                Aucun membre de la famille enregistré.
              </li>
            )}
          </ul>

          <div style={{ marginTop: '25px' }} />

          {/* Formulaire ajout membre famille */}
          <h3 className={styles.subtitle}>Ajouter un membre à la famille :</h3>
          <div className={styles.formGroup}>
            <label htmlFor="memberNom">Nom :</label>
            <input id="memberNom" placeholder="Nom" value={newMember.nom}
              onChange={e => setNewMember({ ...newMember, nom: e.target.value })}
              className={styles.inputField} />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="memberPrenom">Prénom :</label>
            <input id="memberPrenom" placeholder="Prénom" value={newMember.prenom}
              onChange={e => setNewMember({ ...newMember, prenom: e.target.value })}
              className={styles.inputField} />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="memberDateNaissance">Date de naissance :</label>
            <input id="memberDateNaissance" type="date" value={newMember.dateNaissance}
              onChange={e => setNewMember({ ...newMember, dateNaissance: e.target.value })}
              className={styles.inputField} />
            {newMember.dateNaissance && (
              <p className={styles.note}>
                Âge : {calculateAge(newMember.dateNaissance)} ans
              </p>
            )}
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="memberType">Type de lien :</label>
            <select id="memberType" value={newMember.type}
              onChange={e => setNewMember({ ...newMember, type: e.target.value })}
              className={styles.inputField}
            >
              <option value="">-- Type --</option>
              <option value="conjoint">Conjoint(e)</option>
              <option value="enfant">Enfant</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <button onClick={handleAddMember} className={`${styles.button} ${styles.submitButton}`} disabled={blockSubmit}>
            Ajouter à la famille
          </button>
          <button onClick={handleDeleteEmploye} className={`${styles.button} ${styles.dangerButton}`} style={{ marginTop: '15px' }}>
            Supprimer Employé
          </button>
        </fieldset>
      )}
    </div>
  );
}
