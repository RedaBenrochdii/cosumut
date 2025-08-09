// src/components/OCRScanner.jsx
import React, { useState, useRef } from 'react';
import axios from 'axios';
import styles from '../styles/FormPage.module.css';

const MAX_SIZE = 1600; // redimension max pour une OCR propre

export default function OCRScanner({ onAutoFill }) {
  const [status, setStatus] = useState('Prêt à scanner');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [imageBlob, setImageBlob] = useState(null);
  const [busy, setBusy] = useState(false);
  const [debugJson, setDebugJson] = useState(null);
  const canvasRef = useRef(null);

  function ensureCanvas() {
    if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
    return canvasRef.current;
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('Chargement image…');

    const img = new Image();
    img.onload = () => {
      const canvas = ensureCanvas();
      const ctx = canvas.getContext('2d');

      const scale = Math.min(1, MAX_SIZE / Math.max(img.width, img.height)) || 1;
      const W = Math.round(img.width * scale);
      const H = Math.round(img.height * scale);

      canvas.width = W; canvas.height = H;
      ctx.save();
      // petit boost pour aider l’OCR (utile même côté Gemini)
      ctx.filter = 'contrast(115%) brightness(108%)';
      ctx.drawImage(img, 0, 0, W, H);
      ctx.restore();

      canvas.toBlob((blob) => {
        setImageBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        setStatus(`Image prête (${W}x${H})`);
      }, 'image/jpeg', 0.95);
    };
    img.src = URL.createObjectURL(file);
  };

  // (Optionnel) Anonymisation manuelle rapide (une bande floue à droite du libellé)
  const handleAnonymize = () => {
    if (!imageBlob) return;
    setStatus('Anonymisation…');
    const img = new Image();
    img.onload = () => {
      const canvas = ensureCanvas();
      const ctx = canvas.getContext('2d');
      canvas.width = img.width; canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Bande approximative sur la ligne "Nom et prénom de l’assuré"
      ctx.save();
      ctx.filter = 'blur(18px)';
      const x = Math.round(canvas.width * 0.32);
      const y = Math.round(canvas.height * 0.355);
      const w = Math.round(canvas.width * 0.67);
      const h = Math.round(canvas.height * 0.065);
      ctx.fillStyle = 'rgba(255,255,255,0.01)';
      ctx.fillRect(x, y, w, h);
      ctx.restore();

      canvas.toBlob((blob) => {
        setImageBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        setStatus('Aperçu anonymisé prêt');
      }, 'image/jpeg', 0.92);
    };
    img.src = previewUrl;
  };

  const handleGeminiOCR = async () => {
    if (!imageBlob) return setStatus('Aucune image à envoyer');
    setBusy(true);
    setStatus('Analyse Gemini…');

    try {
      const form = new FormData();
      form.append('image', imageBlob, 'scan.jpg');

      const res = await axios.post('http://localhost:4000/api/ocr/gemini', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const data = res.data || {};
      setDebugJson(data);

      // Envoi direct au parent : garde les clés standardisées
      onAutoFill?.(data);

      setStatus('Champs extraits (Gemini)');
    } catch (e) {
      console.error(e);
      setStatus('Erreur Gemini');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.ocrSection}>
      <div className={styles.radioGroup}>
        <label className={styles.radioLabel}>
          <input type="radio" checked readOnly /> IA Gemini (sécurisée)
        </label>
      </div>

      <div style={{ margin: '8px 0' }}>
        <input type="file" accept="image/*" onChange={handleFileSelect} />
      </div>

      {previewUrl && (
        <div style={{ marginBottom: 8 }}>
          <img src={previewUrl} alt="Aperçu" style={{ maxWidth: 360, border: '2px solid #ccc', borderRadius: 8 }} />
        </div>
      )}

      {previewUrl && (
        <button onClick={handleAnonymize} className={styles.extractButton} style={{ marginBottom: 6 }}>
          Anonymiser (Blur)
        </button>
      )}

      <button
        onClick={handleGeminiOCR}
        className={styles.extractButton}
        disabled={!previewUrl || busy}
      >
        Envoyer à Gemini
      </button>

      {status && <div className={styles.status} style={{ marginTop: 4 }}>{status}</div>}

      {debugJson && (
        <details style={{ marginTop: 8 }}>
          <summary>JSON extrait (Gemini)</summary>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#f6f6f6', padding: 8, borderRadius: 6 }}>
            {JSON.stringify(debugJson, null, 2)}
          </pre>
        </details>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
