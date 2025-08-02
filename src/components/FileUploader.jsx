// src/components/FileUploader.jsx
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import styles from '../styles/ConsumptionForm.module.css';

/**
 * FileUploader
 * Composant stylé pour importer un fichier Excel et le transformer en JSON.
 * Utilise les classes CSS du module ConsumptionForm.module.css
 */
export function FileUploader({ onDataLoaded, label = 'Choisir un fichier' }) {
  const [fileName, setFileName] = useState('');

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);
        const formatted = json.map(emp => ({
          ...emp,
          Matricule_Employe: emp.Matricule_Employe ? String(emp.Matricule_Employe) : ''
        }));
        onDataLoaded(formatted);
      } catch (err) {
        console.error('Erreur parsing Excel', err);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <label className={styles.uploadContainer}>
      <span className={styles.uploadLabel}>{label}</span>
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFile}
        className={styles.uploadInput}
      />
      {fileName && <span className={styles.fileName}>{fileName}</span>}
    </label>
  );
}
