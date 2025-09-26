import React, { useState } from 'react';
import styles from '../styles/BordereauPage.module.css';

// Composant pour une ligne en mode édition
function EditableRow({ item, idx, onSave, onCancel, hasStatusColumn }) {
  const [editData, setEditData] = useState(item);

  const handleSave = () => {
    onSave(editData, idx);
  };

  const handleChange = (field, value) => {
    setEditData({ ...editData, [field]: value });
  };

  return (
    <tr style={{ backgroundColor: '#f0f8ff', border: '2px solid #3b82f6' }}>
      {hasStatusColumn && (
        <td>
          <span style={{ padding: '4px 8px', fontSize: '12px', color: '#666' }}>
            {item.Status || 'En cours'}
          </span>
        </td>
      )}
      <td>
        <input
          type="date"
          value={editData.DateConsultation || ''}
          onChange={e => handleChange('DateConsultation', e.target.value)}
          className={styles.inputField}
          style={{ width: '100%', fontSize: '12px' }}
        />
      </td>
      <td>
        <input
          type="text"
          value={editData.Matricule_Employe || ''}
          onChange={e => handleChange('Matricule_Employe', e.target.value)}
          className={styles.inputField}
          style={{ width: '100%', fontSize: '12px' }}
        />
      </td>
      <td>
        <input
          type="text"
          value={editData.Nom_Employe || ''}
          onChange={e => handleChange('Nom_Employe', e.target.value)}
          className={styles.inputField}
          style={{ width: '100%', fontSize: '12px' }}
        />
      </td>
      <td>
        <input
          type="text"
          value={editData.Prenom_Employe || ''}
          onChange={e => handleChange('Prenom_Employe', e.target.value)}
          className={styles.inputField}
          style={{ width: '100%', fontSize: '12px' }}
        />
      </td>
      <td>
        <input
          type="text"
          value={editData.Nom_Malade || ''}
          onChange={e => handleChange('Nom_Malade', e.target.value)}
          className={styles.inputField}
          style={{ width: '100%', fontSize: '12px' }}
        />
      </td>
      <td>
        <input
          type="text"
          value={editData.Prenom_Malade || ''}
          onChange={e => handleChange('Prenom_Malade', e.target.value)}
          className={styles.inputField}
          style={{ width: '100%', fontSize: '12px' }}
        />
      </td>
      <td>
        <select
          value={editData.Type_Malade || ''}
          onChange={e => handleChange('Type_Malade', e.target.value)}
          className={styles.inputField}
          style={{ width: '100%', fontSize: '12px' }}
        >
          <option value="">—</option>
          <option value="Medical">Médical</option>
          <option value="Dentaire">Dentaire</option>
          <option value="Optique">Optique</option>
        </select>
      </td>
      <td>
        <input
          type="text"
          value={editData.Nature_Maladie || ''}
          onChange={e => handleChange('Nature_Maladie', e.target.value)}
          className={styles.inputField}
          style={{ width: '100%', fontSize: '12px' }}
          placeholder="grippe, diabète..."
        />
      </td>
      <td>
        <input
          type="number"
          step="0.01"
          value={editData.Montant || editData.Total_Frais_Engages || ''}
          onChange={e => handleChange('Montant', e.target.value)}
          className={styles.inputField}
          style={{ width: '100%', fontSize: '12px' }}
        />
      </td>
      <td>
        <input
          type="number"
          step="0.01"
          value={editData.Montant_Rembourse || ''}
          onChange={e => handleChange('Montant_Rembourse', e.target.value)}
          className={styles.inputField}
          style={{ width: '100%', fontSize: '12px' }}
        />
      </td>
      <td>
        <input
          type="text"
          value={editData.Numero_Declaration || ''}
          onChange={e => handleChange('Numero_Declaration', e.target.value)}
          className={styles.inputField}
          style={{ width: '100%', fontSize: '12px' }}
        />
      </td>
      {/* Colonne Voir en mode édition */}
      <td>
        {editData.file_path ? (
          <a 
            href={`http://localhost:4000/${editData.file_path}`} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: '#3b82f6', fontSize: '11px' }}
          >
            Voir
          </a>
        ) : (
          <span style={{ color: '#999', fontSize: '11px' }}>—</span>
        )}
      </td>
      {/* Colonne bordereau en mode édition */}
      <td>
        {editData.fichier ? (
          <a 
            href={`http://localhost:4000/bordereaux/${editData.fichier}`} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: '#0066cc', fontSize: '11px', textDecoration: 'underline' }}
          >
            {editData.fichier.length > 15 ? editData.fichier.substring(0, 15) + '...' : editData.fichier}
          </a>
        ) : (
          <span style={{ color: '#999', fontSize: '11px' }}>—</span>
        )}
      </td>
      {/* Boutons de sauvegarde/annulation uniquement */}
      <td>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button
            onClick={handleSave}
            className={`${styles.button} ${styles.primaryButton}`}
            style={{ fontSize: '11px', padding: '4px 8px' }}
            type="button"
          >
            Sauver
          </button>
          <button
            onClick={onCancel}
            className={`${styles.button} ${styles.dangerButton}`}
            style={{ fontSize: '11px', padding: '4px 8px' }}
            type="button"
          >
            Annuler
          </button>
        </div>
      </td>
    </tr>
  );
}

// Composant StatusEditor avec validation stricte des valeurs
function StatusEditor({ item, onStatusChange }) {
  const validStatuses = ['En cours', 'Transmis', 'Remboursé', 'Rejeté'];
  
  if (!item.Id || !onStatusChange) {
    const displayStatus = validStatuses.includes(item.Status) ? item.Status : 'En cours';
    return <span style={{ padding: '4px 8px' }}>{displayStatus}</span>;
  }

  const handleStatusChange = (e) => {
    onStatusChange(item.Id, e.target.value);
  };

  const currentStatus = validStatuses.includes(item.Status) ? item.Status : 'En cours';

  const statusColors = {
    'En cours': '#f59e0b',
    'Transmis': '#3b82f6',
    'Remboursé': '#22c55e',
    'Rejeté': '#ef4444',
  };

  return (
    <select
      value={currentStatus}
      onChange={handleStatusChange}
      style={{
        backgroundColor: statusColors[currentStatus] || '#f59e0b',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        padding: '5px 8px',
        fontWeight: 'bold',
        cursor: 'pointer',
        WebkitAppearance: 'none',
        MozAppearance: 'none',
        appearance: 'none',
        fontSize: '12px',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <option value="En cours">En cours</option>
      <option value="Transmis">Transmis</option>
      <option value="Remboursé">Remboursé</option>
      <option value="Rejeté">Rejeté</option>
    </select>
  );
}

// Composant DataTable principal
export function DataTable({ data, onDelete, onDeleteAll, onEdit, onStatusChange, onUpdate }) {
  const [editingIndex, setEditingIndex] = useState(null);

  const handleEdit = (item, idx) => {
    setEditingIndex(idx);
    if (onEdit) onEdit(item, idx);
  };

  const handleSaveEdit = (updatedItem, idx) => {
    if (onUpdate) {
      onUpdate(updatedItem, idx);
    }
    setEditingIndex(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
  };

  const toNumber = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  const totalMontant = data.reduce((sum, item) => sum + toNumber(item.Montant ?? item.Total_Frais_Engages), 0).toFixed(2);
  const totalRembourse = data.reduce((sum, item) => sum + toNumber(item.Montant_Rembourse), 0).toFixed(2);

  const hasStatusColumn = onStatusChange !== undefined;

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            {hasStatusColumn && <th>Statut</th>}
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
            <th>Déclaration</th>
            <th>Voir</th>
            <th>Bordereau</th>
            {editingIndex !== null && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && (
            <tr>
              <td colSpan={hasStatusColumn ? 15 : 14} style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
                Aucun dossier à afficher.
              </td>
            </tr>
          )}
          {data.map((item, idx) => 
            editingIndex === idx ? (
              <EditableRow
                key={item.Id || idx}
                item={item}
                idx={idx}
                onSave={handleSaveEdit}
                onCancel={handleCancelEdit}
                hasStatusColumn={hasStatusColumn}
              />
            ) : (
              <tr key={item.Id || idx} onDoubleClick={() => handleEdit(item, idx)} style={{ cursor: 'pointer' }} title="Double-cliquez pour modifier">
                {hasStatusColumn && (
                  <td>
                    <StatusEditor item={item} onStatusChange={onStatusChange} />
                  </td>
                )}
                <td>{item.DateConsultation ? new Date(item.DateConsultation).toLocaleDateString() : '—'}</td>
                <td>{item.Matricule_Employe || item.Matricule_Ste || '—'}</td>
                <td>{item.Nom_Employe || '—'}</td>
                <td>{item.Prenom_Employe || '—'}</td>
                <td>{item.Nom_Malade || '—'}</td>
                <td>{item.Prenom_Malade || '—'}</td>
                <td>{item.Type_Malade || '—'}</td>
                <td>{item.Nature_Maladie || '—'}</td>
                <td>{item.Montant ?? item.Total_Frais_Engages ?? '0.00'}</td>
                <td>{item.Montant_Rembourse ?? '0.00'}</td>
                <td>{item.Numero_Declaration || '—'}</td>
                
                {/* COLONNE VOIR (remplace Document) */}
                <td>
                  {item.file_path ? (
                    <a 
                      href={`http://localhost:4000/${item.file_path}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ 
                        color: '#3b82f6', 
                        textDecoration: 'underline',
                        fontSize: '0.9em'
                      }}
                    >
                      Voir
                    </a>
                  ) : (
                    <span style={{ color: '#999', fontSize: '0.9em' }}>—</span>
                  )}
                </td>
                
                {/* COLONNE BORDEREAU */}
                <td>
                  {item.fichier ? (
                    <a 
                      href={`http://localhost:4000/bordereaux/${item.fichier}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ 
                        color: '#0066cc', 
                        textDecoration: 'underline',
                        fontSize: '0.85em',
                        fontWeight: '500'
                      }}
                      title={`Télécharger: ${item.fichier}`}
                    >
                      {item.fichier}
                    </a>
                  ) : (
                    <span style={{ 
                      color: '#6c757d', 
                      fontSize: '0.85em',
                      fontStyle: 'italic'
                    }}>
                      —
                    </span>
                  )}
                </td>
              </tr>
            )
          )}
        </tbody>
        {data.length > 0 && (
          <tfoot>
            <tr style={{ backgroundColor: '#f8f9fa', fontWeight: 'bold' }}>
              <td colSpan={hasStatusColumn ? 10 : 9} style={{ textAlign: 'right', fontWeight: 600 }}>
                Totaux :
              </td>
              <td style={{ fontWeight: 700, color: '#0056b3' }}>{totalMontant} DH</td>
              <td style={{ fontWeight: 700, color: '#28a745' }}>{totalRembourse} DH</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        )}
      </table>
      
      {/* Bouton Supprimer Tout */}
      {data.length > 0 && onDeleteAll && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={() => {
              if (window.confirm(`Supprimer TOUS les ${data.length} dossiers ?\n\nCette action est irréversible !`)) {
                onDeleteAll();
              }
            }}
            className={`${styles.button} ${styles.dangerButton}`}
            style={{ fontSize: '0.9em', padding: '8px 16px' }}
            type="button"
          >
            Supprimer Tout ({data.length})
          </button>
        </div>
      )}
    </div>
  );
}
