// src/components/OCRAnonymizer.jsx
import React, { useRef, useState } from "react";
import { createWorker } from "tesseract.js";

// ===== Réglages rapides =====
const DEBUG = false;                 // true => dessine la zone floutée (cadre vert)
const BLUR_PX = 16;                  // force du flou
const LANGS = "fra+eng";             // OCR FR + EN pour tolérer les variantes
// Fallback si l’OCR ne trouve pas la ligne (gabarit du formulaire COSUMAR)
const TEMPLATE_ZONE = { xStart: 0.32, yStart: 0.355, height: 0.065, rightPad: 0.01 };

// Séquences cibles tolérantes (ordre respecté, pas nécessairement contigu)
const TARGETS = [
  ["nom","et","prenom","de","l","assure"],      // “Nom et prénom de l’assuré”
  ["nom","et","prenom","du","malade"],          // “Nom et prénom du malade”
  ["nom","du","malade"],                        // “Nom du malade”
  ["nom","de","lassure"]                        // tolérance
];

// ===== Utils OCR/texte =====
function norm(s=""){
  return s.toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu,"")
    .replace(/[’']/g,"'")
    .replace(/\s+/g," ")
    .trim();
}

function tokensFromWords(words){
  return (words||[]).map(w => ({
    t: norm((w.text||"").replace(/^l'\s*/i,"l ")),  // l’assuré -> l assure
    bbox: w.bbox || { x0:0, y0:0, x1:0, y1:0 }
  }));
}

/** Trouve la bbox d'une séquence de tokens (ordre respecté, fenêtre ≤ 12 mots) */
function findSequenceBBox(words, target){
  const W = tokensFromWords(words);
  for (let i=0;i<W.length;i++){
    let j=0, xs=[], xe=[], ys=[], ye=[];
    for (let k=i;k<W.length && j<target.length && k<i+12;k++){
      const tok = W[k].t;
      const want = target[j];
      const ok =
        (want==="prenom" && /prenom/.test(tok)) ||
        (want==="assure" && /assure/.test(tok)) ||
        tok===want;
      if (ok){
        const b = W[k].bbox;
        xs.push(b.x0); xe.push(b.x1); ys.push(b.y0); ye.push(b.y1);
        j++;
      }
      if (j===target.length){
        return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xe), y1: Math.max(...ye) };
      }
    }
  }
  return null;
}

/** Floute un rectangle (fix : filtre appliqué lors de la recopie sur le canvas principal) */
function blurRect(ctx, x, y, w, h, blurPx = BLUR_PX){
  if (w<=0 || h<=0) return;
  const off = document.createElement("canvas");
  off.width = w; off.height = h;
  const octx = off.getContext("2d");
  // copie la zone dans l’offscreen
  octx.drawImage(ctx.canvas, x, y, w, h, 0, 0, w, h);
  // applique le flou en recopiant sur la destination
  ctx.save();
  ctx.filter = `blur(${blurPx}px)`;
  ctx.drawImage(off, 0, 0, w, h, x, y, w, h);
  ctx.restore();
}

export default function OCRAnonymizer({ onAutoExtract }) {
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
    img.onload = async () => {
      // Canvas de travail
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");

      // Boost léger (aide OCR et lisibilité)
      ctx.save();
      ctx.filter = "contrast(118%) brightness(108%)";
      ctx.drawImage(img, 0, 0);
      ctx.restore();

      // ====== OCR (mots) pour trouver la ligne cible ======
      let worker;
      let labelBox = null;
      try {
        worker = await createWorker({ logger: () => {} });
        await worker.loadLanguage(LANGS);
        await worker.initialize(LANGS);
        await worker.setParameters({
          tessedit_pageseg_mode: "6",
          preserve_interword_spaces: "1",
          user_defined_dpi: "300"
        });

        const { data } = await worker.recognize(canvas);
        const words = data?.words || [];

        // essaie toutes les séquences
        for (const tgt of TARGETS){
          labelBox = findSequenceBBox(words, tgt);
          if (labelBox) break;
        }
      } catch (err) {
        console.error("Tesseract error:", err);
      } finally {
        try { await worker?.terminate(); } catch {}
      }

      // ====== Calcule la zone à flouter ======
      const marginX = Math.round(canvas.width * 0.01);
      const marginY = Math.round(canvas.height * 0.012);

      let x, y, w, h, by;
      if (labelBox){
        // à droite du libellé détecté
        x = Math.min(labelBox.x1 + marginX, canvas.width - 1);
        y = Math.max(labelBox.y0 - marginY, 0);
        h = Math.min((labelBox.y1 - labelBox.y0) + 2*marginY, canvas.height - y);
        w = Math.max(1, canvas.width - x - marginX);
        by = "words";
      } else {
        // fallback template
        x = Math.round(canvas.width  * TEMPLATE_ZONE.xStart);
        y = Math.round(canvas.height * TEMPLATE_ZONE.yStart);
        h = Math.round(canvas.height * TEMPLATE_ZONE.height);
        w = canvas.width - x - Math.round(canvas.width * TEMPLATE_ZONE.rightPad);
        by = "template";
        setOcrError("⚠️ Libellé non détecté — zone template appliquée.");
      }

      // Debug : visualiser la zone
      if (DEBUG){
        ctx.save();
        ctx.strokeStyle = "lime"; ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
        ctx.restore();
      }

      // ====== Applique le flou ======
      blurRect(ctx, x, y, w, h, BLUR_PX);

      // Sortie
      canvas.toBlob((blob) => {
        setAnonymizedBlob(blob);
        setPreview(URL.createObjectURL(blob));
        setProcessing(false);
      }, "image/jpeg", 0.95);
    };
    img.src = URL.createObjectURL(file);
  };

  const handleSendGemini = async () => {
    setProcessing(true);
    setOcrError("");
    try {
      const fd = new FormData();
      const toSend = anonymizedBlob || origBlob; // envoie l’anonymisé si dispo
      if (!toSend) throw new Error("Aucune image prête");
      fd.append("image", toSend, "scan.jpg");

      const res = await fetch("http://localhost:4000/api/ocr/gemini", {
        method: "POST",
        body: fd
      });
      if (!res.ok) throw new Error("Erreur backend");
      const data = await res.json();
      onAutoExtract?.(data);
    } catch (err) {
      console.error(err);
      setOcrError("Erreur OCR Gemini ou connexion au serveur");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={processing}
        style={{ display: "block", margin: "1rem 0" }}
      />

      {processing && <div style={{ color: "orange" }}>Anonymisation/OCR en cours…</div>}
      {ocrError && <div style={{ color: "red", marginBottom: 10 }}>{ocrError}</div>}

      {preview && (
        <div>
          <div style={{ marginBottom: "0.5rem" }}>Aperçu anonymisé :</div>
          <img
            src={preview}
            alt="Aperçu anonymisé"
            style={{ maxWidth: 450, border: "2px solid #666", borderRadius: 6 }}
          />
        </div>
      )}

      {(preview || origBlob) && !processing && (
        <button
          type="button"
          onClick={handleSendGemini}
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
          Envoyer à Gemini
        </button>
      )}
    </div>
  );
}
