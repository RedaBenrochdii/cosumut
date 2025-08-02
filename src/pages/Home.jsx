import React from 'react';
import styles from '../styles/Home.module.css';

export default function Home() {
  return (
    <div className={`${styles.container} ${styles.gradientBackground}`}>
      <div className={styles.overlay}>
        <h1>Bienvenue sur <strong>CosuMutuel</strong></h1>
        <p>Plateforme moderne pour la gestion des dossiers médicaux mutualistes.</p>
        <button
          className={styles.enterButton}
          onClick={() => window.location.href = '/form'}
        >
          Remplire le formulaire
        </button>
      </div>
    </div>
  );
}