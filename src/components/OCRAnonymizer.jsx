// src/components/OCRAnonymizer.jsx
import React, { useRef, useState } from "react";

/** ===== Réglages ===== */
const API_URL = "http://127.0.0.1:4001/api/ocr/paddle"; // FastAPI ci-dessous
const BLUR_PX = 16;                                      // intensité du flou (masquage)
const CANVAS_MAX_W = 450;

function blurRect(ctx, x, y, w, h, blurPx = BLUR_PX) {
  if (w <= 0 || h <= 0) return;
  const off = document.createElement("canvas");
  off.width = w; off.height = h;
  const octx = off.getContext("2d");
  octx.drawImage(ctx.canvas, x, y, w, h, 0, 0, w, h);
  ctx.save();
  ctx.filter = `blur(${blurPx}px)`;
  ctx.drawImage(off, 0, 0, w, h, x, y, w, h);
  ctx.restore();
}

export default function OCRAnonymizer({ onAutoExtract, ocrEngine = "gemini" }) {
  const [preview, setPreview] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [anonymizedBlob, setAnonymizedBlob] = useState(null);
  const [origBlob, setOrigBlob] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    setProcessing(true);
    setOcrError("");
    setAnonymizedBlob(null);
    setPreview(null);

    const file = e.target.files?.[0];
    if (!file) { setProcessing(false); return; }
    setOrigBlob(file);

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = async () => {
      // === Dessin + même pré-traitement que ta version Tesseract ===
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = id.data;
      const contrast = 1.15;   // 115%
      const brightness = 1.06; // 106%
      const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i+1], b = d[i+2];
        // N&B doux + contraste léger
        let v = 0.299 * r + 0.587 * g + 0.114 * b;
        v = factor * (v - 128) + 128;
        v = v * brightness;
        v = Math.max(0, Math.min(255, v));
        d[i] = d[i+1] = d[i+2] = v;
      }
      ctx.putImageData(id, 0, 0);
      URL.revokeObjectURL(url);

      try {
        // Envoi la version pré-traitée au backend PaddleOCR
        const blob = await new Promise(res => canvas.toBlob(res, "image/png", 0.95));
        const fd = new FormData();
        fd.append("file", blob, "preprocessed.png");

        const resp = await fetch(API_URL, { method: "POST", body: fd });
        if (!resp.ok) throw new Error(`API ${resp.status}`);
        const data = await resp.json(); // { masks: [...], debug: {...} }

        // Applique les masques renvoyés (normalisés 0..1 ou en pixels)
        const cw = canvas.width, ch = canvas.height;
        const toPx = (m) => {
          if (m.normalized || (m.x <= 1 && m.y <= 1 && (m.width ?? m.w) <= 1 && (m.height ?? m.h) <= 1)) {
            const w = (m.width ?? m.w), h = (m.height ?? m.h);
            return { x: Math.round(m.x * cw), y: Math.round(m.y * ch), w: Math.round(w * cw), h: Math.round(h * ch) };
          }
          return { x: Math.round(m.x), y: Math.round(m.y), w: Math.round(m.width), h: Math.round(m.height) };
        };

        (data.masks || []).forEach(m => {
          const { x, y, w, h } = toPx(m);
          blurRect(ctx, x, y, w, h, BLUR_PX);
        });

        // Aperçu
        const outBlob = await new Promise(res => canvas.toBlob(res, "image/jpeg", 0.95));
        setAnonymizedBlob(outBlob);
        setPreview(URL.createObjectURL(outBlob));
      } catch (err) {
        console.error(err);
        setOcrError("Erreur OCR Paddle ou connexion au serveur.");
      } finally {
        setProcessing(false);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      setProcessing(false);
      setOcrError("Impossible de charger l’image.");
    };
    img.src = url;
  };

  // Envoi vers le moteur OCR sélectionné
  const handleSendOCR = async () => {
    setProcessing(true);
    setOcrError("");
    try {
      const fd = new FormData();
      let toSend;
      let endpoint = "";
      if (ocrEngine === "gemini") {
        toSend = anonymizedBlob || origBlob;
        fd.append("image", toSend, "scan.jpg");
        endpoint = "http://localhost:4001/api/ocr/gemini";
      } else if (ocrEngine === "paddle") {
        toSend = anonymizedBlob || origBlob;
        fd.append("file", toSend, "scan.png");
        endpoint = "http://127.0.0.1:4001/api/ocr/paddle";
      } else if (ocrEngine === "tesseract") {
        toSend = anonymizedBlob || origBlob;
        fd.append("file", toSend, "scan.png");
        endpoint = "http://localhost:4001/api/ocr/tesseract";
      } else {
        throw new Error("Moteur OCR inconnu");
      }
      if (!toSend) throw new Error("Aucune image prête");
      const res = await fetch(endpoint, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Erreur backend");
      const data = await res.json();
      let extracted = data;
      // Mapping for PaddleOCR response
      if (ocrEngine === "paddle" && data && typeof data === "object") {
        if (data.fields) {
          extracted = {
            Date_Consultation: data.fields.Date_Consultation || data.fields.date_consultation || "",
            Matricule_Ste: data.fields.Matricule_Ste || data.fields.matricule || "",
            Nom_Prenom_Assure: data.fields.Nom_Prenom_Assure || data.fields.nom_assure || "",
            Numero_Contrat: data.fields.Numero_Contrat || data.fields.numero_contrat || "",
            Numero_Affiliation: data.fields.Numero_Affiliation || data.fields.numero_affiliation || "",
            Numero_Declaration: data.fields.Numero_Declaration || data.fields.numero_declaration || "",
            Lien_Parente: data.fields.Lien_Parente || data.fields.lien_parente || "",
            Nom_Prenom_Malade: data.fields.Nom_Prenom_Malade || data.fields.nom_malade || "",
            Age_Malade: data.fields.Age_Malade || data.fields.age_malade || "",
            Nature_Maladie: data.fields.Nature_Maladie || data.fields.nature_maladie || "",
            Total_Frais_Engages: data.fields.Total_Frais_Engages || data.fields.total_frais || ""
          };
        } else if (data.result) {
          extracted = { ...data.result };
        }
      }
      // Mapping for Tesseract.js response
      if (ocrEngine === "tesseract" && data && typeof data === "object") {
        if (data.fields) {
          extracted = {
            Date_Consultation: data.fields.Date_Consultation || data.fields.date_consultation || "",
            Matricule_Ste: data.fields.Matricule_Ste || data.fields.matricule || "",
            Nom_Prenom_Assure: data.fields.Nom_Prenom_Assure || data.fields.nom_assure || "",
            Numero_Contrat: data.fields.Numero_Contrat || data.fields.numero_contrat || "",
            Numero_Affiliation: data.fields.Numero_Affiliation || data.fields.numero_affiliation || "",
            Numero_Declaration: data.fields.Numero_Declaration || data.fields.numero_declaration || "",
            Lien_Parente: data.fields.Lien_Parente || data.fields.lien_parente || "",
            Nom_Prenom_Malade: data.fields.Nom_Prenom_Malade || data.fields.nom_malade || "",
            Age_Malade: data.fields.Age_Malade || data.fields.age_malade || "",
            Nature_Maladie: data.fields.Nature_Maladie || data.fields.nature_maladie || "",
            Total_Frais_Engages: data.fields.Total_Frais_Engages || data.fields.total_frais || ""
          };
        } else if (data.result) {
          extracted = { ...data.result };
        }
      }
      onAutoExtract?.(extracted);
    } catch (err) {
      console.error(err);
      setOcrError("Erreur OCR ou connexion au serveur");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <fieldset style={{ border: "1px solid var(--border-light)", borderRadius: 8, padding: "12px 14px" }}>
        <legend style={{ padding: "0 8px" }}>Scan de Document (OCR)</legend>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={processing}
          style={{ display: "block", margin: "0.5rem 0 1rem" }}
        />

        {processing && <div style={{ color: "orange", marginBottom: 6 }}>Anonymisation/OCR en cours…</div>}
        {ocrError && <div style={{ color: "red", marginBottom: 10 }}>⚠️ {ocrError}</div>}

        {preview && (
          <div>
            <div style={{ marginBottom: "0.5rem" }}>Aperçu anonymisé :</div>
            <img
              src={preview}
              alt="Aperçu anonymisé"
              style={{ maxWidth: CANVAS_MAX_W, border: "2px solid #666", borderRadius: 6 }}
            />
          </div>
        )}

        {(preview || origBlob) && !processing && (
          <button
            type="button"
            onClick={handleSendOCR}
            style={{
              marginTop: 14,
              padding: "10px 22px",
              borderRadius: 6,
              background: "#2c77c9",
              color: "#fff",
              border: "none",
              fontWeight: "bold",
              cursor: "pointer"
            }}
          >
            {ocrEngine === "gemini"
              ? "Envoyer à Gemini"
              : ocrEngine === "paddle"
              ? "Envoyer à PaddleOCR"
              : ocrEngine === "tesseract"
              ? "Envoyer à Tesseract.js"
              : "Envoyer"}
          </button>
        )}
      </fieldset>
    </div>
  );
}
