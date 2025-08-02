import React, { useEffect, useState } from 'react';
import styles from '../styles/DocumentsReceived.module.css';

const API_BASE = 'http://localhost:4000';

export default function DocumentsReceived() {
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    fetch(`${API_BASE}/documents`)
      .then(res => res.json())
      .then(setDocuments)
      .catch(console.error);
  }, []);

  const docsFiltres = documents
    .filter(doc =>
      search ? (doc.nom || '').toLowerCase().includes(search.toLowerCase()) : true
    )
    .sort((a, b) => {
      const dateA = new Date(a.date || 0);
      const dateB = new Date(b.date || 0);
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Documents Reçus</h1>
          <p className={styles.subtitle}>Tous les fichiers envoyés par les employés ou agents</p>
        </div>

        <div className={styles.controls}>
          <input
            type="text"
            placeholder="Rechercher par nom..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={styles.input}
          />
          <select
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value)}
            className={styles.select}
          >
            <option value="desc"> Plus récents</option>
            <option value="asc">Plus anciens</option>
          </select>
        </div>
      </div>

      <div className={styles.grid}>
        {docsFiltres.length === 0 ? (
          <p className={styles.empty}>Aucun document trouvé.</p>
        ) : (
          docsFiltres.map((doc, idx) => (
            <div key={doc.filename} className={styles.card}>
              <div className={styles.imageWrapper}>
                <img
                  src={`${API_BASE}/uploads/${doc.filename}`}
                  alt={`Document ${idx + 1}`}
                  className={styles.image}
                />
              </div>
              <div className={styles.cardContent}>
                <div className={styles.filename}>- {doc.filename}</div>
                <div className={styles.meta}>- Commentaire : {doc.commentaire || '—'}</div>
                <div className={styles.meta}>- Date : {new Date(doc.date).toLocaleString('fr-FR')}</div>
                <div className={styles.meta}>- Origine : {doc.source || 'Non précisée'}</div>
                <a
                  href={`${API_BASE}/uploads/${doc.filename}`}
                  download
                  className={styles.download}
                >
                   Télécharger
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
