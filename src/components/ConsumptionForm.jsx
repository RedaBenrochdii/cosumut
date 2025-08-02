import React, { useEffect, useState } from 'react';
import styles from '../styles/ConsumptionForm.module.css';
import axios from 'axios';

export function ConsumptionForm({
  formData,
  onMatriculeChange,
  onNomChange,
  onChange,
  onSubmit,
  setFormData,
  setAlertDate,
  setBlockSubmit,
  onCalculate,
  dependents = []
}) {
  const [matriculeTimeout, setMatriculeTimeout] = useState(null);
  const [childrenOptions, setChildrenOptions] = useState([]);
  const [conjointOption, setConjointOption] = useState(null);

  const handleAutoFill = (data) => {
    setFormData((prev) => ({
      ...prev,
      ...data,
      Montant: data.Montant || prev.Montant,
      DateConsultation: data.DateConsultation || prev.DateConsultation,
    }));
  };

  const handleMatriculeBlur = () => {
    const matricule = formData.Matricule_Employe?.trim();
    if (!matricule) return;

    axios.get(`http://localhost:4000/api/employes/${matricule}`)
      .then(res => {
        const emp = res.data;
        setFormData((prev) => ({
          ...prev,
          Nom_Employe: emp.Nom_Employe || '',
          Prenom_Employe: emp.Prenom_Employe || '',
          Nom_Malade: emp.Nom_Employe || '',
          Prenom_Malade: emp.Prenom_Employe || '',
          DateConsultation: new Date().toISOString().split('T')[0]
        }));
      })
      .catch(err => {
        console.warn("Employé non trouvé :", err.response?.data?.error || err.message);
      });
  };

  useEffect(() => {
    if (matriculeTimeout) clearTimeout(matriculeTimeout);
    setMatriculeTimeout(setTimeout(handleMatriculeBlur, 600));
    return () => clearTimeout(matriculeTimeout);
  }, [formData.Matricule_Employe]);

  useEffect(() => {
    const matricule = formData.Matricule_Employe?.trim();
    const droit = formData.Ayant_Droit?.toLowerCase();

    if (!matricule || !droit) return;

    const updateFromAyantDroit = async () => {
      try {
        if (droit === 'employe') {
          setFormData(prev => ({
            ...prev,
            Nom_Malade: prev.Nom_Employe,
            Prenom_Malade: prev.Prenom_Employe
          }));
          setAlertDate('');
          setBlockSubmit(false);
        } else if (droit === 'conjoint') {
          const res = await axios.get(`http://localhost:4000/api/employes/${matricule}/conjoint`);
          const conjoint = res.data;
          if (conjoint) {
            setConjointOption(conjoint);
            setFormData(prev => ({
              ...prev,
              Nom_Malade: conjoint.Nom_Conjoint || '',
              Prenom_Malade: conjoint.Prenom_Conjoint || ''
            }));
          }
          setAlertDate('');
          setBlockSubmit(false);
        } else if (droit === 'enfant') {
          const res = await axios.get(`http://localhost:4000/api/employes/${matricule}/enfants`);
          const enfants = res.data;
          setChildrenOptions(enfants);

          if (enfants.length === 1) {
            const enfant = enfants[0];
            const age = new Date().getFullYear() - new Date(enfant.DateNaissance).getFullYear();
            setFormData(prev => ({
              ...prev,
              Nom_Malade: prev.Nom_Employe,
              Prenom_Malade: enfant.Prenom_Enfant
            }));
            if (age >= 25) {
              setAlertDate(`⚠️ Enfant a ${age} ans (limite 25 ans)`);
              setBlockSubmit(true);
            } else {
              setAlertDate('');
              setBlockSubmit(false);
            }
          } else {
            setFormData(prev => ({
              ...prev,
              Nom_Malade: prev.Nom_Employe,
              Prenom_Malade: ''
            }));
            setAlertDate('');
            setBlockSubmit(false);
          }
        }
      } catch (err) {
        console.error("Erreur Ayant Droit :", err.message);
        setAlertDate('');
        setBlockSubmit(false);
      }
    };

    updateFromAyantDroit();
  }, [formData.Ayant_Droit, formData.Matricule_Employe, formData.Nom_Employe, formData.Prenom_Employe]);

  return (
    <>
      <form onSubmit={(e) => onSubmit(e, formData)} className={styles.form}>
        <input name="Matricule_Employe" value={formData.Matricule_Employe} onChange={onMatriculeChange} placeholder="Matricule Employé" required className={styles.input} />
        <input list="noms-employes" name="Nom_Employe" value={formData.Nom_Employe} onChange={onNomChange} placeholder="Nom Employé" required className={styles.input} />
        <datalist id="noms-employes">
          {dependents.map((emp, i) => <option key={i} value={emp.Nom_Employe} />)}
        </datalist>
        <input name="Prenom_Employe" value={formData.Prenom_Employe} onChange={onChange} placeholder="Prénom Employé" required className={styles.input} />
        <input type="date" name="DateConsultation" value={formData.DateConsultation} onChange={onChange} required className={styles.input} />
        <input name="Nom_Malade" value={formData.Nom_Malade} onChange={onChange} placeholder="Nom Malade" className={styles.input} />

        {formData.Ayant_Droit === 'enfant' && childrenOptions.length > 0 ? (
          <select
            name="Prenom_Malade"
            onChange={(e) => {
              const selected = JSON.parse(e.target.value);
              const birthDate = new Date(selected.DateNaissance);
              const today = new Date();
              const age = today.getFullYear() - birthDate.getFullYear();
              const isBirthdayPassed =
                today.getMonth() > birthDate.getMonth() ||
                (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
              const realAge = isBirthdayPassed ? age : age - 1;

              const updatedForm = {
                ...formData,
                Prenom_Malade: selected.Prenom_Enfant,
                Nom_Malade: formData.Nom_Employe,
              };
              setFormData(updatedForm);

              const syntheticPrenomEvent = { target: { name: 'Prenom_Malade', value: selected.Prenom_Enfant } };
              const syntheticNomEvent = { target: { name: 'Nom_Malade', value: formData.Nom_Employe } };

              onChange(syntheticPrenomEvent);
              onChange(syntheticNomEvent);

              if (realAge >= 25) {
                setAlertDate(`⚠️ L'enfant a ${realAge} ans. Limite autorisée : 25 ans.`);
                setBlockSubmit(true);
              } else {
                setAlertDate('');
                setBlockSubmit(false);
              }
            }}
            className={styles.input}
            required
          >
            <option value="">-- Choisir l’enfant --</option>
            {childrenOptions.map((child, i) => (
              <option key={i} value={JSON.stringify(child)}>
                {child.Prenom_Enfant}
              </option>
            ))}
          </select>
        ) : formData.Ayant_Droit === 'conjoint' && conjointOption ? (
          <select
            name="Prenom_Malade"
            onChange={(e) => {
              const selected = JSON.parse(e.target.value);
              const birthDate = new Date(selected.DateNaissance);
              const today = new Date();
              const age = today.getFullYear() - birthDate.getFullYear();
              const isBirthdayPassed =
                today.getMonth() > birthDate.getMonth() ||
                (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
              const realAge = isBirthdayPassed ? age : age - 1;

              setFormData(prev => ({
                ...prev,
                Prenom_Malade: selected.Prenom_Conjoint,
                Nom_Malade: selected.Nom_Conjoint,
              }));

              if (realAge >= 60) {
                setAlertDate(`⚠️ Le conjoint a ${realAge} ans. Limite autorisée : 60 ans.`);
                setBlockSubmit(true);
              } else {
                setAlertDate('');
                setBlockSubmit(false);
              }
            }}
            className={styles.input}
            required
          >
            <option value="">-- Choisir le conjoint --</option>
            {Array.isArray(conjointOption) ? (
              conjointOption.map((conj, i) => (
                <option key={i} value={JSON.stringify(conj)}>
                  {conj.Prenom_Conjoint}
                </option>
              ))
            ) : (
              <option value={JSON.stringify(conjointOption)}>
                {conjointOption.Prenom_Conjoint}
              </option>
            )}
          </select>
        ) : (
          <input
            name="Prenom_Malade"
            value={formData.Prenom_Malade}
            onChange={onChange}
            placeholder="Prénom Malade"
            className={styles.input}
            required
          />
        )}

        <select name="Type_Malade" value={formData.Type_Malade} onChange={onChange} required className={styles.input}>
          <option value="">-- Type consultation --</option>
          <option value="médicale">Médicale</option>
          <option value="optique">Optique</option>
          <option value="dentaire">Dentaire</option>
        </select>

        <input
          type="text"
          name="Montant"
          value={formData.Montant}
          onChange={onChange}
          onBlur={(e) => onCalculate('Montant', e.target.value)}
          placeholder="Montant (ex: 150+300)"
          className={styles.input}
        />
        <input type="number" name="Montant_Rembourse" value={formData.Montant_Rembourse} onChange={onChange} placeholder="Montant Remboursé" className={styles.input} />
        <input name="Code_Assurance" value={formData.Code_Assurance} onChange={onChange} placeholder="Code Assurance" className={styles.input} />
        <input type="text" name="Numero_Declaration" value={formData.Numero_Declaration} onChange={onChange} placeholder="Numéro de déclaration" required className={styles.input} />

        <select name="Ayant_Droit" value={formData.Ayant_Droit} onChange={onChange} required className={styles.input}>
          <option value="">-- Ayant droit --</option>
          <option value="employe">Employé</option>
          <option value="conjoint">Conjoint</option>
          <option value="enfant">Enfant</option>
        </select>

        <button type="submit" className={styles.button}>Ajouter</button>
      </form>
    </>
  );
}