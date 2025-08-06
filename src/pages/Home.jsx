import React from 'react';
import styles from '../styles/Home.module.css';
import bgImage from '../assets/cosumprog.png';

export default function Home() {
  return (
    <div className={styles.container}>
      <div
        className={styles.backgroundImage}
        style={{ backgroundImage: `url(${bgImage})` }}
      ></div>

      <div className={styles.overlay}>
        <div className={styles.textTop}>
  <h1>Bienvenue sur <strong>CosuMutuel</strong></h1>
  <p>Plateforme moderne pour la gestion des dossiers médicaux mutualistes.</p>
</div>

<button
  className={`${styles.enterButton} ${styles.bottomButton}`}
  onClick={() => (window.location.href = '/form')}
>
  Remplire le formulaire
</button>

      </div>
    </div>
  );
}
