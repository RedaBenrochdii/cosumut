import React, { useState } from 'react';
import { ipcRenderer } from 'electron';
import './ExcelAutoLoader.css'; // fichier CSS externe

const ExcelAutoLoader = ({ onDataLoaded }) => {
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    setLoading(true);
    try {
      const data = await ipcRenderer.invoke('open-excel-file');
      if (data) {
        onDataLoaded(data);
      } else {
        alert('Aucun fichier sélectionné');
      }
    } catch (error) {
      console.error('Erreur lors de l\'importation du fichier Excel:', error);
      alert('Une erreur est survenue.');
    }
    setLoading(false);
  };

  return (
    <div className="excel-loader-container">
      <button
        className={`excel-loader-button ${loading ? 'loading' : ''}`}
        onClick={handleImport}
        disabled={loading}
      >
        {loading ? <span className="spinner" /> : '📄 Importer un fichier Excel'}
      </button>
    </div>
  );
};

export default ExcelAutoLoader;
