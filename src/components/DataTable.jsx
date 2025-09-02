import React from 'react';
import styles from '../styles/BordereauPage.module.css'; // réutilise les styles (table, buttons, etc.)

export function DataTable({ data, onDelete, onDeleteAll, onEdit }) {
  const toNumber = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  const totalMontant = data.reduce((sum, item) => sum + toNumber(item.Montant ?? item.Total_Frais_Engages), 0).toFixed(2);
  const totalRembourse = data.reduce((sum, item) => sum + toNumber(item.Montant_Rembourse), 0).toFixed(2);

  return (
    <div className={styles.tableContainer}>
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
            <th>Nature Maladie</th>
            <th>Montant</th>
            <th>Remboursé</th>
            <th>Code Assurance</th>
            <th>Déclaration</th>
            <th>Ayant droit</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {data.length === 0 && (
            <tr>
              <td colSpan={14} style={{ textAlign: 'center', color: '#666' }}>
                Aucun dossier à afficher.
              </td>
            </tr>
          )}

          {data.map((item, idx) => (
            <tr key={idx}>
              <td>{item.DateConsultation || '—'}</td>
              <td>{item.Matricule_Employe || item.Matricule_Ste || '—'}</td>
              <td>{item.Nom_Employe || '—'}</td>
              <td>{item.Prenom_Employe || '—'}</td>
              <td>{item.Nom_Malade || '—'}</td>
              <td>{item.Prenom_Malade || '—'}</td>
              <td>{item.Type_Malade || '—'}</td>
              <td>{item.Nature_Maladie || '—'}</td>
              <td>{item.Montant ?? item.Total_Frais_Engages ?? '0.00'}</td>
              <td>{item.Montant_Rembourse ?? '0.00'}</td>
              <td>{item.Code_Assurance || '—'}</td>
              <td>{item.Numero_Declaration || '—'}</td>
              <td>{item.Ayant_Droit || item.Lien_Parente || '—'}</td>
              <td>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => onEdit?.(item, idx)}
                    className={`${styles.button} ${styles.primaryButton}`}
                    style={{ backgroundColor: 'var(--warning-color, #f59e0b)' }}
                    type="button"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => onDelete?.(idx)}
                    className={`${styles.button} ${styles.dangerButton}`}
                    type="button"
                  >
                    Supprimer
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>

        {data.length > 0 && (
          <tfoot>
            <tr>
              <td colSpan={8} style={{ textAlign: 'right', fontWeight: 600 }}>Totaux :</td>
              <td style={{ fontWeight: 700 }}>{totalMontant}</td>
              <td style={{ fontWeight: 700 }}>{totalRembourse}</td>
              <td colSpan={4}></td>
            </tr>
          </tfoot>
        )}
      </table>

      {data.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={onDeleteAll}
            className={`${styles.button} ${styles.dangerButton}`}
            type="button"
          >
            Supprimer Tout
          </button>
        </div>
      )}
    </div>
  );
}
