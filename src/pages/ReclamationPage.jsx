import React, { useEffect, useState, useCallback } from 'react';
import styles from '../styles/ProductionDashboard.module.css';
import axios from 'axios';

export default function ProductionDashboard() {
  // États existants
  const [employes, setEmployes] = useState([]);
  const [selectedMatricule, setSelectedMatricule] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
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

  // États pour la gestion des utilisateurs
  const [activeTab, setActiveTab] = useState('employees');
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'agent' });
  const [userMessage, setUserMessage] = useState('');

  // États pour la gestion des mots de passe
  const [passwordResetData, setPasswordResetData] = useState({
    targetUsername: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswordReset, setShowPasswordReset] = useState(null);

  // Fonction existante
  const fetchEmployes = useCallback(() => {
    axios.get('http://localhost:4000/api/employes')
      .then(res => setEmployes(res.data))
      .catch(err => {
        console.error('Erreur chargement employés :', err);
        setAlertMessage('Erreur lors du chargement des employés.');
      });
  }, []);

  // Charger les utilisateurs avec gestion d'erreurs
  const loadUsers = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setUserMessage('Token manquant - Reconnectez-vous');
        return;
      }

      const res = await axios.get('http://localhost:4000/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setUsers(res.data);
      setUserMessage('');
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error.response || error);
      
      if (error.response?.status === 401) {
        setUserMessage('Session expirée - Reconnectez-vous');
      } else if (error.response?.status === 403) {
        setUserMessage('Accès refusé - Droits admin requis');
      } else {
        setUserMessage('Erreur lors du chargement des utilisateurs');
      }
    }
  }, []);

  useEffect(() => {
    fetchEmployes();
    if (activeTab === 'users') {
      loadUsers();
    }
  }, [fetchEmployes, activeTab, loadUsers]);

  // Créer un utilisateur
  const createUser = async () => {
    if (!newUser.username || !newUser.password) {
      setUserMessage('Nom d\'utilisateur et mot de passe requis');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:4000/api/register', newUser, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewUser({ username: '', password: '', role: 'agent' });
      loadUsers();
      setUserMessage('Utilisateur créé avec succès');
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Erreur création utilisateur';
      setUserMessage(`${errorMsg}`);
    }
  };

  // Supprimer un utilisateur
  const deleteUser = async (userId) => {
    if (window.confirm('Supprimer cet utilisateur ?')) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`http://localhost:4000/api/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        loadUsers();
        setUserMessage('Utilisateur supprimé');
      } catch (error) {
        setUserMessage('Erreur suppression');
      }
    }
  };

  // Modifier le rôle
  const changeUserRole = async (userId, newRole) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`http://localhost:4000/api/users/${userId}/role`, 
        { role: newRole }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      loadUsers();
      setUserMessage(`Rôle mis à jour vers ${newRole}`);
    } catch (error) {
      setUserMessage('Erreur modification rôle');
    }
  };

  // Fonction pour reset mot de passe
  const resetUserPassword = async (userId, username) => {
    if (!passwordResetData.newPassword || !passwordResetData.confirmPassword) {
      setUserMessage('Veuillez remplir tous les champs');
      return;
    }

    if (passwordResetData.newPassword !== passwordResetData.confirmPassword) {
      setUserMessage('Les mots de passe ne correspondent pas');
      return;
    }

    if (passwordResetData.newPassword.length < 6) {
      setUserMessage('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const adminUsername = localStorage.getItem('username');
      
      await axios.post('http://localhost:4000/api/reset-password', {
        adminUsername: adminUsername,
        targetUsername: username,
        newPassword: passwordResetData.newPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setUserMessage(`Mot de passe de ${username} réinitialisé avec succès`);
      setShowPasswordReset(null);
      setPasswordResetData({ targetUsername: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setUserMessage('Erreur: ' + (error.response?.data?.error || 'Erreur lors de la réinitialisation'));
    }
  };

  // Fonctions existantes
  const selectedEmploye = employes.find(emp => emp.Matricule_Employe === selectedMatricule);

  const calculateAge = (date) => {
    if (!date) return '';
    const birth = new Date(date);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  };

  const handleAddMember = async () => {
    if (!newMember.nom || !newMember.type || !selectedMatricule) {
      setAlertMessage("Nom, Type et matricule requis pour ajouter un membre !");
      return;
    }

    const age = calculateAge(newMember.dateNaissance);
    if (newMember.type === 'enfant' && age > 25) {
      setAlertMessage(`L'enfant a ${age} ans. Limite autorisée : 25 ans.`);
      return setBlockSubmit(true);
    }
    if (newMember.type === 'conjoint' && age > 60) {
      setAlertMessage(`Le conjoint a ${age} ans. Limite autorisée : 60 ans.`);
      return setBlockSubmit(true);
    }

    setAlertMessage('');
    setBlockSubmit(false);

    try {
      const response = await axios.post(`http://localhost:4000/api/employes/${selectedMatricule}/famille/add`, newMember);
      if (response.data.success) {
        fetchEmployes();
        setNewMember({ nom: '', prenom: '', type: '', dateNaissance: '' });
        setAlertMessage('Membre de la famille ajouté avec succès !');
      } else {
        setAlertMessage(response.data.error || "Erreur lors de l'ajout du membre.");
      }
    } catch (err) {
      console.error('Erreur ajout membre famille :', err);
      setAlertMessage("Erreur serveur lors de l'ajout du membre de la famille.");
    }
  };

  const handleDeleteMember = async (index) => {
    if (!selectedEmploye) return;

    try {
      fetchEmployes();
      setAlertMessage('Membre de la famille supprimé avec succès !');
    } catch (err) {
      console.error('Erreur suppression membre famille :', err);
      setAlertMessage('Erreur lors de la suppression du membre de la famille.');
    }
  };

  const handleAddEmploye = async () => {
    if (!newEmploye.Matricule_Employe || !newEmploye.Nom_Employe || !newEmploye.Prenom_Employe || !newEmploye.DateNaissance) {
      setAlertMessage("Tous les champs (Matricule, Nom, Prénom, Date de naissance) sont requis pour le nouvel employé !");
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
        setAlertMessage('Employé ajouté avec succès !');
      } else {
        setAlertMessage(response.data.error || "Erreur lors de l'ajout de l'employé.");
      }
    } catch (err) {
      console.error('Erreur ajout employé :', err);
      setAlertMessage("Erreur lors de l'ajout de l'employé. Vérifiez si le matricule existe déjà.");
    }
  };

  const handleFileChange = (e) => {
    setExcelFile(e.target.files[0]);
    setExcelUploadMessage('');
  };

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
      setExcelUploadMessage(response.data.message);
      setExcelFile(null);
      document.getElementById('excelUpload').value = '';
      fetchEmployes();
    } catch (error) {
      console.error('Erreur lors de l\'upload du fichier Excel:', error);
      setExcelUploadMessage('Erreur lors de l\'upload du fichier Excel.');
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Administration - Production</h1>

      {/* Onglets de navigation */}
      <div style={{ borderBottom: '1px solid #ddd', marginBottom: '20px' }}>
        <button 
          onClick={() => setActiveTab('employees')}
          style={{ 
            padding: '10px 20px', 
            backgroundColor: activeTab === 'employees' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'employees' ? 'white' : '#333',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '4px 4px 0 0'
          }}
        >
          Gestion Employés
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          style={{ 
            padding: '10px 20px', 
            backgroundColor: activeTab === 'users' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'users' ? 'white' : '#333',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '4px 4px 0 0',
            marginLeft: '4px'
          }}
        >
          Gestion Utilisateurs
        </button>
      </div>

      {/* CONTENU ONGLET EMPLOYÉS */}
      {activeTab === 'employees' && (
        <>
          {alertMessage && (
            <div className={`${styles.alert} ${alertMessage.includes('succès') ? styles.alertSuccess : styles.alertDanger}`}>
              {alertMessage}
            </div>
          )}

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
              <p className={`${styles.alert} ${excelUploadMessage.includes('importés') ? styles.alertSuccess : styles.alertDanger}`}>
                {excelUploadMessage}
              </p>
            )}
          </fieldset>

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

          {selectedEmploye && (
            <fieldset className={styles.card}>
              <legend>Famille de {selectedEmploye.Nom_Employe} {selectedEmploye.Prenom_Employe}</legend>
              <h3 className={styles.subtitle}>Membres de la famille :</h3>
              <ul className={styles.employeeList} style={{ maxHeight: '150px' }}>
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
            </fieldset>
          )}
        </>
      )}

      {/* ONGLET GESTION UTILISATEURS */}
      {activeTab === 'users' && (
        <>
          {userMessage && (
            <div className={`${styles.alert} ${userMessage.includes('succès') || userMessage.includes('réinitialisé') ? styles.alertSuccess : styles.alertDanger}`}>
              {userMessage}
            </div>
          )}

          {/* Formulaire création utilisateur */}
          <fieldset className={styles.card}>
            <legend>Ajouter un nouvel utilisateur</legend>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
              <div className={styles.formGroup}>
                <label>Nom d'utilisateur :</label>
                <input 
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                  placeholder="Nom d'utilisateur"
                  className={styles.inputField}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Mot de passe :</label>
                <input 
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  placeholder="Mot de passe"
                  className={styles.inputField}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Rôle :</label>
                <select 
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                  className={styles.inputField}
                >
                  <option value="agent">Agent</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button onClick={createUser} className={`${styles.button} ${styles.primaryButton}`}>
                Créer
              </button>
            </div>
          </fieldset>

          {/* Liste des utilisateurs */}
          <fieldset className={styles.card}>
            <legend>Liste des utilisateurs</legend>
            {users.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                {userMessage || 'Chargement des utilisateurs...'}
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>ID</th>
                      <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Nom d'utilisateur</th>
                      <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Rôle</th>
                      <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Créé le</th>
                      <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <React.Fragment key={user.Id}>
                        <tr>
                          <td style={{ padding: '12px', border: '1px solid #ddd' }}>{user.Id}</td>
                          <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                            <strong>{user.username}</strong>
                          </td>
                          <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                            <select 
                              value={user.role} 
                              onChange={(e) => changeUserRole(user.Id, e.target.value)}
                              style={{ 
                                backgroundColor: user.role === 'admin' ? '#dc3545' : '#28a745',
                                color: 'white',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                border: 'none',
                                fontSize: '0.8em'
                              }}
                            >
                              <option value="agent">agent</option>
                              <option value="admin">admin</option>
                            </select>
                          </td>
                          <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                            {new Date(user.CreatedAt).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {/* Bouton Reset Mot de Passe */}
                              <button 
                                onClick={() => {
                                  if (showPasswordReset === user.Id) {
                                    setShowPasswordReset(null);
                                  } else {
                                    setShowPasswordReset(user.Id);
                                    setPasswordResetData({...passwordResetData, targetUsername: user.username});
                                  }
                                }}
                                style={{
                                  backgroundColor: showPasswordReset === user.Id ? '#ffc107' : '#007bff',
                                  color: 'white',
                                  border: 'none',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '0.8em'
                                }}
                              >
                                {showPasswordReset === user.Id ? 'Annuler' : 'Mot de passe'}
                              </button>
                              
                              {/* Bouton Supprimer */}
                              <button 
                                onClick={() => deleteUser(user.Id)}
                                className={`${styles.button} ${styles.dangerButton}`}
                                style={{ fontSize: '0.8em', padding: '4px 8px' }}
                              >
                                Supprimer
                              </button>
                            </div>
                          </td>
                        </tr>
                        
                        {/* Ligne dépliante pour reset mot de passe */}
                        {showPasswordReset === user.Id && (
                          <tr>
                            <td colSpan="5" style={{ padding: '16px', backgroundColor: '#f8f9fa', border: '1px solid #ddd' }}>
                              <div style={{ maxWidth: '500px' }}>
                                <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>
                                  Réinitialiser le mot de passe de <strong>{user.username}</strong>
                                </h4>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                                  <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em', fontWeight: '600' }}>
                                      Nouveau mot de passe :
                                    </label>
                                    <input
                                      type="password"
                                      value={passwordResetData.newPassword}
                                      onChange={(e) => setPasswordResetData({...passwordResetData, newPassword: e.target.value})}
                                      placeholder="Minimum 6 caractères"
                                      minLength={6}
                                      className={styles.inputField}
                                      style={{ fontSize: '14px' }}
                                    />
                                  </div>
                                  
                                  <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em', fontWeight: '600' }}>
                                      Confirmer :
                                    </label>
                                    <input
                                      type="password"
                                      value={passwordResetData.confirmPassword}
                                      onChange={(e) => setPasswordResetData({...passwordResetData, confirmPassword: e.target.value})}
                                      placeholder="Répéter le mot de passe"
                                      className={styles.inputField}
                                      style={{ fontSize: '14px' }}
                                    />
                                  </div>
                                  
                                  <button
                                    onClick={() => resetUserPassword(user.Id, user.username)}
                                    style={{
                                      backgroundColor: '#28a745',
                                      color: 'white',
                                      border: 'none',
                                      padding: '10px 16px',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '0.9em',
                                      fontWeight: '600'
                                    }}
                                  >
                                    Réinitialiser
                                  </button>
                                </div>
                                
                                <p style={{ margin: '10px 0 0 0', fontSize: '0.85em', color: '#666' }}>
                                  Cette action changera immédiatement le mot de passe de l'utilisateur.
                                </p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </fieldset>
        </>
      )}
    </div>
  );
}
