import React from 'react';
import styles from '../styles/BordereauPage.module.css'; // S'assurer que le bon fichier de style est importé

export function DataTable({ data, onDelete, onDeleteAll, onEdit }) {
  // Calcul des totaux
  const totalMontant = data
    .reduce((sum, item) => sum + parseFloat(item.Montant || 0), 0)
    .toFixed(2);
  const totalRembourse = data
    .reduce((sum, item) => sum + parseFloat(item.Montant_Rembourse || 0), 0)
    .toFixed(2);

  return (
    <div className={styles.tableContainer}> {/* Utilise le conteneur pour le défilement horizontal */}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Matricule</th>
            <th>Nom</th>
            <th>Prénom</th>
            <th>Nom Malade</th>
            <th>Prénom Malade</th>
            <th>Type</th>
            <th>Montant</th>
            <th>Remboursé</th>
            <th>Code Assurance</th>
            <th>Déclaration</th>
            <th>Ayant droit</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, idx) => (
            <tr key={idx}>
              <td>{item.DateConsultation}</td>
              <td>{item.Matricule_Employe}</td>
              <td>{item.Nom_Employe}</td>
              <td>{item.Prenom_Employe}</td>
              <td>{item.Nom_Malade}</td>
              <td>
                {item.Prenom_Malade 
                  ? item.Prenom_Malade 
                  : <em style={{ color: 'gray' }}>—</em>}
              </td>
              <td>{item.Type_Malade}</td>
              <td>{item.Montant}</td>
              <td>{item.Montant_Rembourse}</td>
              <td>{item.Code_Assurance}</td>
              <td>{item.Numero_Declaration}</td>
              <td>{item.Ayant_Droit}</td>
              <td>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => onEdit(item, idx)}
                    className={`${styles.button} ${styles.primaryButton}`}
                    style={{ backgroundColor: 'var(--warning-color)' }} /* Bouton Modifier en jaune */
                  >
                    ✏️ Modifier
                  </button>
                  <button
                    onClick={() => onDelete(idx)}
                    className={`${styles.button} ${styles.dangerButton}`}
                  >
                    🗑️ Supprimer
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>

        {data.length > 0 && (
          <tfoot>
            <tr>
              <td colSpan={7} style={{ textAlign: 'right', fontWeight: 'bold' }}>
                Totaux :
              </td>
              <td style={{ fontWeight: 'bold' }}>{totalMontant}</td>
              <td style={{ fontWeight: 'bold' }}>{totalRembourse}</td>
              <td colSpan={4}></td>
            </tr>
          </tfoot>
        )}
      </table>

      {data.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            onClick={onDeleteAll}
            className={`${styles.button} ${styles.dangerButton}`}
          >
            Supprimer Tout
          </button>
        </div>
      )}
    </div>
  );
}
