// src/components/OCRManualMask.jsx
import React, { useRef, useState, useEffect } from "react";

const MAX_SIZE = 1600;          // redimension max (px)
const DEFAULT_BLUR_PX = 18;     // intensité flou

export default function OCRManualMask({ onAutoExtract }) {
  const [status, setStatus] = useState("Prêt");
  const [mode, setMode] = useState("black"); // "black" | "blur"
  const [blurPx, setBlurPx] = useState(DEFAULT_BLUR_PX);
  const [previewURL, setPreviewURL] = useState(null);
  const [origBlob, setOrigBlob] = useState(null);

  const [masks, setMasks] = useState([]); // {x,y,w,h,type}
  const [drawing, setDrawing] = useState(null); // {x0,y0,x1,y1}
  const [anonymizedBlob, setAnonymizedBlob] = useState(null);

  const canvasRef = useRef(null);
  const baseImageRef = useRef(null);

  // --- utils
  const ensureCanvas = () => {
    if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
    return canvasRef.current;
  };

  const drawScene = () => {
    const canvas = ensureCanvas();
    const ctx = canvas.getContext("2d");
    const img = baseImageRef.current;
    if (!img) return;

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // Aperçu des masques
    ctx.save();
    masks.forEach(m => {
      if (m.type === "black") {
        ctx.fillStyle = "rgba(0,0,0,0.88)";
        ctx.fillRect(m.x, m.y, m.w, m.h);
      } else {
        // preview flou = cadre bleu
        ctx.strokeStyle = "rgba(30,144,255,0.95)";
        ctx.lineWidth = 2;
        ctx.strokeRect(m.x, m.y, m.w, m.h);
        ctx.font = "12px sans-serif";
        ctx.fillStyle = "rgba(30,144,255,0.95)";
        ctx.fillText("flou", m.x + 6, m.y + 16);
      }
    });
    ctx.restore();

    // rectangle en cours
    if (drawing) {
      const { x0, y0, x1, y1 } = drawing;
      const x = Math.min(x0, x1), y = Math.min(y0, y1);
      const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = mode === "black" ? "rgba(0,0,0,0.95)" : "rgba(30,144,255,0.95)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }
  };

  useEffect(() => { drawScene(); /* eslint-disable-next-line */ }, [previewURL, masks, drawing, mode]);

  // --- fichier -> redimension -> preview
  const handleFile = (file) => {
    setStatus("Chargement image…");
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIZE / Math.max(img.width, img.height)) || 1;
      const W = Math.round(img.width * scale);
      const H = Math.round(img.height * scale);

      const c = ensureCanvas();
      const ctx = c.getContext("2d");
      c.width = W; c.height = H;
      ctx.save();
      ctx.filter = "contrast(112%) brightness(106%)";
      ctx.drawImage(img, 0, 0, W, H);
      ctx.restore();

      const base = new Image();
      base.onload = () => {
        baseImageRef.current = base;
        setPreviewURL(c.toDataURL("image/jpeg", 0.95));
        setStatus(`Image prête (${W}x${H})`);
      };
      base.src = c.toDataURL("image/jpeg", 0.95);

      c.toBlob((blob) => {
        setOrigBlob(blob);
        setAnonymizedBlob(null);
      }, "image/jpeg", 0.95);
    };
    img.src = URL.createObjectURL(file);
  };

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setMasks([]);
    setDrawing(null);
    handleFile(f);
  };

  // --- pointer events
  const getOffset = (evt) => {
    const canvas = ensureCanvas();
    const rect = canvas.getBoundingClientRect();
    const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
    const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
    const x = Math.max(0, Math.min(canvas.width,  ((clientX - rect.left) / rect.width) * canvas.width));
    const y = Math.max(0, Math.min(canvas.height, ((clientY - rect.top)  / rect.height) * canvas.height));
    return { x, y };
  };

  const onDown = (e) => {
    if (!previewURL) return;
    e.preventDefault();
    const { x, y } = getOffset(e);
    setDrawing({ x0: x, y0: y, x1: x, y1: y });
  };
  const onMove = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const { x, y } = getOffset(e);
    setDrawing(d => ({ ...d, x1: x, y1: y }));
  };
  const onUp = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const { x0, y0, x1, y1 } = drawing;
    const x = Math.round(Math.min(x0, x1));
    const y = Math.round(Math.min(y0, y1));
    const w = Math.round(Math.abs(x1 - x0));
    const h = Math.round(Math.abs(y1 - y0));
    setDrawing(null);
    if (w < 6 || h < 6) return;
    setMasks(ms => [...ms, { x, y, w, h, type: mode }]);
  };

  // --- actions
  const undoLast = () => setMasks(ms => ms.slice(0, -1));
  const clearAll = () => setMasks([]);

  const applyMasks = () => {
    const base = baseImageRef.current;
    if (!base) return;
    setStatus("Application des masques…");

    const out = document.createElement("canvas");
    out.width = base.width; out.height = base.height;
    const ctx = out.getContext("2d");
    ctx.drawImage(base, 0, 0);

    masks.forEach(m => {
      if (m.type === "black") {
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#000";
        ctx.fillRect(m.x, m.y, m.w, m.h);
        ctx.restore();
      } else {
        // flou local : copie offscreen puis blur sur destination
        const off = document.createElement("canvas");
        off.width = m.w; off.height = m.h;
        const octx = off.getContext("2d");
        octx.drawImage(out, m.x, m.y, m.w, m.h, 0, 0, m.w, m.h);
        ctx.save();
        ctx.filter = `blur(${Math.max(2, blurPx)}px)`;
        ctx.drawImage(off, 0, 0, m.w, m.h, m.x, m.y, m.w, m.h);
        ctx.restore();
      }
    });

    out.toBlob((blob) => {
      setAnonymizedBlob(blob);
      setPreviewURL(URL.createObjectURL(blob));
      setStatus("Masques appliqués ✅");
    }, "image/jpeg", 0.95);
  };

  const sendToGemini = async () => {
    setStatus("Envoi à Gemini…");
    try {
      const fd = new FormData();
      const toSend = anonymizedBlob || origBlob;
      if (!toSend) throw new Error("Aucune image");
      fd.append("image", toSend, "scan.jpg");
      const res = await fetch("http://localhost:4000/api/ocr/gemini", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Erreur backend");
      const data = await res.json();
      onAutoExtract?.(data); // renvoie l'objet JSON de Gemini au parent
      setStatus("Champs extraits (Gemini) ✅");
    } catch (e) {
      console.error(e);
      setStatus("Erreur Gemini");
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <input type="file" accept="image/*" onChange={onFileChange} />
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label>
          <input type="radio" name="maskmode" value="black" checked={mode === "black"} onChange={() => setMode("black")} />
          &nbsp;Masque <b>noir</b>
        </label>
        <label>
          <input type="radio" name="maskmode" value="blur" checked={mode === "blur"} onChange={() => setMode("blur")} />
          &nbsp;Masque flou
        </label>
        {mode === "blur" && (
          <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            Intensité:&nbsp;
            <input type="number" min={6} max={40} value={blurPx} onChange={e => setBlurPx(Number(e.target.value)||DEFAULT_BLUR_PX)} style={{ width: 64 }} />
            px
          </label>
        )}
        <button onClick={undoLast} disabled={!masks.length}>Annuler dernier</button>
        <button onClick={clearAll} disabled={!masks.length}>Tout effacer</button>
        <button onClick={applyMasks} disabled={!previewURL || (!masks.length && !anonymizedBlob)}>
          Appliquer masques
        </button>
        <button onClick={sendToGemini} disabled={!previewURL}>Envoyer à Gemini</button>
      </div>

      <div
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onTouchStart={onDown}
        onTouchMove={onMove}
        onTouchEnd={onUp}
        style={{ touchAction: "none", cursor: previewURL ? "crosshair" : "default", marginTop: 10,
                 border: "1px solid #ddd", borderRadius: 8, padding: 8 }}
      >
        {previewURL ? (
          <canvas ref={canvasRef} style={{ width: "100%", maxWidth: 640, display: "block" }} />
        ) : (
          <div style={{ color: "#666" }}>Choisissez une image puis dessinez des rectangles pour masquer.</div>
        )}
      </div>

      <div style={{ marginTop: 8, color: "#555" }}>{status}</div>
    </div>
  );
}
