// src/components/OCRScanner.jsx
import React, { useState, useEffect, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import axios from 'axios';
import styles from '../styles/FormPage.module.css';

const MAX_SIZE = 1200; // Max largeur/hauteur de l'image redimensionnée (px)

const OCRScanner = ({ onAutoFill }) => {
  const [ocrMethod, setOcrMethod] = useState('gemini');
  const [status, setStatus] = useState('Prêt à scanner');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [anonymizedBlob, setAnonymizedBlob] = useState(null);
  const workerRef = useRef(null);

  useEffect(() => {
    if (ocrMethod === 'tesseract' && !workerRef.current) {
      setStatus('Chargement Tesseract...');
      createWorker('fra').then(worker => {
        workerRef.current = worker;
        setStatus('Tesseract prêt');
      }).catch(err => {
        setStatus('Erreur Tesseract');
        console.error(err);
      });
    }
  }, [ocrMethod]);

  // 1. Fichier choisi → resize → preview → option blur
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setStatus(`Chargement image...`);
    const img = new window.Image();
    img.onload = () => {
      let scale = 1;
      if (img.width > MAX_SIZE || img.height > MAX_SIZE) {
        scale = Math.min(MAX_SIZE / img.width, MAX_SIZE / img.height);
      }
      const outW = Math.round(img.width * scale);
      const outH = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, outW, outH);

      // -- Option : blur ici (ex : zone hardcodée pour POC) --
      // Ex : flouter rectangle (protection RGPD)
      // ctx.filter = "blur(8px)";
      // ctx.fillRect(x, y, w, h); // À toi de personnaliser !

      canvas.toBlob(blob => {
        setSelectedFile(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        setStatus(`Image prête (${outW}x${outH}px)`);
        setAnonymizedBlob(null); // Reset anonymized si on change de fichier
      }, "image/jpeg", 0.94);
    };
    img.src = URL.createObjectURL(file);
  };

  // 2. Anonymisation manuelle par blur (rectangle)
  const handleAnonymize = () => {
    if (!selectedFile) return;
    setStatus("Anonymisation en cours...");
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      // Flouter une zone (tu peux ajuster : x, y, w, h)
      // Exemple POC (haut, centre de l'image, largeurs typiques : ajuster !)
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.filter = "blur(16px)";
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillRect(90, 85, 330, 48); // <-- A AJUSTER selon ton doc/photo !
      ctx.restore();

      canvas.toBlob(blob => {
        setAnonymizedBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        setStatus("Aperçu anonymisé prêt !");
      }, "image/jpeg", 0.92);
    };
    img.src = previewUrl;
  };

  // 3. Envoi OCR Gemini
  const handleGeminiOCR = async () => {
    const imgToSend = anonymizedBlob || selectedFile;
    if (!imgToSend) {
      setStatus("Aucune image à envoyer !");
      return;
    }
    setStatus('Analyse Gemini en cours...');
    const formData = new FormData();
    formData.append('image', imgToSend, "scan.jpg");

    try {
      const res = await axios.post('http://localhost:4000/api/ocr/gemini', formData);
      onAutoFill(res.data);
      setStatus('Champs extraits avec succès (Gemini)');
    } catch (error) {
      setStatus('Erreur Gemini');
      console.error("Erreur OCR Gemini:", error);
    }
  };

  // 4. Envoi Tesseract (local)
  const handleTesseractOCR = async () => {
    if (!workerRef.current) {
      setStatus("Tesseract non prêt");
      return;
    }
    setStatus('Analyse Tesseract...');
    const { data: { text } } = await workerRef.current.recognize(anonymizedBlob || selectedFile);
    const fields = parseTesseractText(text);
    onAutoFill(fields);
    setStatus('Champs extraits (Tesseract)');
  };

  // Parsing simple pour Tesseract (à améliorer selon tes besoins)
  const parseTesseractText = (text) => {
    const parsedFields = {};
    // Ajoute tes regex personnalisées ici !
    const contractMatch = text.match(/Contrat\s*:\s*(\w+)/i);
    if (contractMatch) parsedFields.Numero_Contrat = contractMatch[1];
    // ... etc (voir ton exemple précédent)
    return parsedFields;
  };

  return (
    <div className={styles.ocrSection}>
      {/* --- Choix méthode OCR --- */}
      <div className={styles.radioGroup}>
        <label className={styles.radioLabel}>
          <input type="radio" name="ocrMethod" value="gemini"
            checked={ocrMethod === 'gemini'}
            onChange={() => setOcrMethod('gemini')} />
          IA Gemini (sécurisée)
        </label>
        <label className={styles.radioLabel}>
          <input type="radio" name="ocrMethod" value="tesseract"
            checked={ocrMethod === 'tesseract'}
            onChange={() => setOcrMethod('tesseract')} />
          Local (Tesseract.js)
        </label>
      </div>
      {/* --- Sélecteur de fichier --- */}
      <div style={{ margin: '8px 0' }}>
        <input type="file" accept="image/*" onChange={handleFileSelect} />
      </div>
      {/* --- Aperçu image --- */}
      {previewUrl &&
        <div style={{ marginBottom: 8 }}>
          <img src={previewUrl} alt="Aperçu" style={{ maxWidth: 360, border: "2px solid #ccc", borderRadius: 8 }} />
        </div>
      }
      {/* --- Anonymiser bouton --- */}
      {selectedFile && (
        <button onClick={handleAnonymize} className={styles.extractButton}
          style={{ marginBottom: 6 }}>Anonymiser (Blur)</button>
      )}
      {/* --- Extraction OCR bouton --- */}
      <button
        onClick={ocrMethod === 'gemini' ? handleGeminiOCR : handleTesseractOCR}
        className={styles.extractButton}
        disabled={!(selectedFile || anonymizedBlob) || status.includes('en cours')}>
        Envoyer à {ocrMethod === 'gemini' ? "Gemini" : "Tesseract"}
      </button>
      {/* --- Statut --- */}
      {status && <div className={styles.status} style={{ marginTop: 4 }}>{status}</div>}
    </div>
  );
};

export default OCRScanner;
