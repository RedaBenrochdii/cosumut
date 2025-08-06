// src/components/OCRScanner.jsx (ou OCRScanner.js)
import React, { useState, useEffect, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import axios from 'axios';
// Note: Le style est maintenant géré par FormPage.module.css, donc pas besoin d'importer ici
// import styles from '../styles/OCRScanner.module.css'; 
import styles from '../styles/FormPage.module.css'; // Utilisez le même module CSS que FormPage

const OCRScanner = ({ onAutoFill }) => {
  const [ocrMethod, setOcrMethod] = useState('gemini');
  const [status, setStatus] = useState('Prêt à scanner');
  const [selectedFile, setSelectedFile] = useState(null);
  const workerRef = useRef(null);

  useEffect(() => {
    if (ocrMethod === 'tesseract' && !workerRef.current) {
      setStatus('Chargement Tesseract...');
      // Assurez-vous que la langue 'fra' est disponible ou téléchargez-la
      createWorker('fra').then(worker => {
        workerRef.current = worker;
        setStatus('Tesseract prêt');
      }).catch(err => {
        console.error("Erreur de chargement de Tesseract:", err);
        setStatus('Erreur de chargement Tesseract');
      });
    }
  }, [ocrMethod]);

  // Étape 1: L'utilisateur sélectionne un fichier
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setStatus(`Fichier prêt : ${file.name}`);
    }
  };

  // Étape 2: L'utilisateur clique sur "Extraire"
  const handleExtract = () => {
    if (!selectedFile) {
      // alert("Veuillez d'abord choisir un fichier."); // Remplacer par un modal si possible
      setStatus("Veuillez d'abord choisir un fichier.");
      return;
    }

    if (ocrMethod === 'gemini') {
      handleGeminiOCR(selectedFile);
    } else {
      handleTesseractOCR(selectedFile);
    }
  };

  const handleGeminiOCR = async (file) => {
    const formData = new FormData();
    formData.append('image', file);

    try {
      setStatus('Analyse Gemini en cours...');
      // Remarque : L'URL de l'API doit être correctement configurée côté serveur
      const res = await axios.post('http://localhost:4000/api/ocr/gemini', formData);
      // Supposons que res.data contient un objet avec les champs à remplir
      onAutoFill(res.data); 
      setStatus(' Champs extraits avec succès !');
      setSelectedFile(null);
    } catch (error) {
      console.error("Erreur OCR Gemini:", error);
      setStatus('Erreur Gemini');
      // alert("Une erreur est survenue lors de l'analyse par l'IA."); // Remplacer par un modal
    }
  };
  
  const handleTesseractOCR = async (file) => {
    if (!workerRef.current) {
        // alert("Tesseract n'est pas encore chargé. Veuillez patienter."); // Remplacer par un modal
        setStatus("Tesseract n'est pas encore chargé. Veuillez patienter.");
        return;
    }
    setStatus('Analyse Tesseract en cours...');
    const { data: { text } } = await workerRef.current.recognize(file);
    // Logique d'extraction des champs à partir du texte brut de Tesseract
    // Ceci est un exemple, vous devrez implémenter une logique de parsing plus robuste
    const fields = parseTesseractText(text); 
    onAutoFill(fields);
    setStatus('✅ Champs extraits (Tesseract)');
    setSelectedFile(null);
  };

  // Fonction utilitaire pour parser le texte de Tesseract (exemple rudimentaire)
  const parseTesseractText = (text) => {
    const parsedFields = {};
    // Exemple très simple: chercher des mots-clés et extraire la valeur suivante
    const contractMatch = text.match(/Contrat\s*:\s*(\w+)/i);
    if (contractMatch) parsedFields.Numero_Contrat = contractMatch[1];

    const affiliationMatch = text.match(/Affiliation\s*:\s*(\w+)/i);
    if (affiliationMatch) parsedFields.Numero_Affiliation = affiliationMatch[1];

    const matriculeMatch = text.match(/Matricule\s*Ste\s*:\s*(\w+)/i);
    if (matriculeMatch) parsedFields.Matricule_Ste = matriculeMatch[1];

    const assureMatch = text.match(/Nom\s+et\s+prénom\s+de\s+l'assuré\s*:\s*(.+)/i);
    if (assureMatch) parsedFields.Nom_Prenom_Assure = assureMatch[1].trim();

    const dateConsultationMatch = text.match(/Date\s+de\s+la\s+consultation\s*:\s*(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/i);
    if (dateConsultationMatch) {
      // Convertir le format de date si nécessaire (ex: JJ/MM/AAAA vers AAAA-MM-JJ)
      let date = dateConsultationMatch[1];
      if (date.includes('/')) {
        const parts = date.split('/');
        date = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      parsedFields.Date_Consultation = date;
    }

    // Ajoutez d'autres logiques de parsing pour les autres champs
    // Par exemple, pour les types de déclaration (Medical, Dentaire, Optique), vous pourriez chercher la présence de ces mots.
    if (text.toLowerCase().includes('médical')) parsedFields.Type_Declaration = 'Medical';
    else if (text.toLowerCase().includes('dentaire')) parsedFields.Type_Declaration = 'Dentaire';
    else if (text.toLowerCase().includes('optique')) parsedFields.Type_Declaration = 'Optique';

    // Pour les frais engagés, cela peut être plus complexe car il faut extraire des nombres
    const fraisMatch = text.match(/Total\s+des\s+frais\s+engagés\s*:\s*([\d\.,]+)/i);
    if (fraisMatch) parsedFields.Total_Frais_Engages = parseFloat(fraisMatch[1].replace(',', '.'));


    return parsedFields;
  };


  return (
    <div className={styles.ocrSection}>
      
      <div className={styles.radioGroup}>
        <label className={styles.radioLabel}>
          <input 
            type="radio" 
            name="ocrMethod" 
            value="gemini" 
            checked={ocrMethod === 'gemini'} 
            onChange={() => setOcrMethod('gemini')} 
          />
          IA Gemini (Recommandé)
        </label>
        <label className={styles.radioLabel}>
          <input 
            type="radio" 
            name="ocrMethod" 
            value="tesseract" 
            checked={ocrMethod === 'tesseract'} 
            onChange={() => setOcrMethod('tesseract')} 
          />
          Local (Tesseract.js)
        </label>
      </div>
      
      <div className={styles.controls}>
        <label className={styles.uploadLabel}>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
          />
          <span className={styles.uploadButton}>
        
          </span>
        </label>

        <button 
          onClick={handleExtract} 
          className={styles.extractButton}
          disabled={!selectedFile || status.includes('en cours...') || status.includes('Chargement Tesseract...')}
        >
          {status.includes('en cours...') ? 'Analyse...' : 'Extraire'}
        </button>
      </div>

      {status && <div className={styles.status}>{status}</div>}
    </div>
  );
};

export default OCRScanner;