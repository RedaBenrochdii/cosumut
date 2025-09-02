# backend/server_paddle.py
import io, unicodedata, math
from typing import List, Dict, Any
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import numpy as np
import cv2
from paddleocr import PaddleOCR

app = FastAPI(title="PaddleOCR anonymizer")

# --- CORS (adapte si besoin) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # ou ["http://localhost:5173", "http://127.0.0.1:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- OCR (langue française) ---
ocr = PaddleOCR(
    lang="fr", use_angle_cls=True, show_log=False, rec=True, det=True
)

# ====== Réglages, identiques à ton front ======
LEFT_ANCHOR_MAX_X = 0.65   # l'ancre (x0) doit être dans les 65% gauche
MARGIN_Y = 0.020           # marge verticale supplémentaire
NEGATIVE_HINTS = [
    "declaration de maladie", "type de declaration", "cachet de l employeur",
    "n du contrat", "n affiliation", "matricule site", "total des frais engages",
    "cachet du medecin", "date de la consultation", "lien de parente",
    "nature de la maladie", "signature de l assure",
]

def norm(s: str) -> str:
    s = s.lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("’", "'").replace("'", "'")
    for ch in ":;,.()-_/\\": s = s.replace(ch, " ")
    return " ".join(s.split())

def only_letters(s: str) -> str:
    return "".join(ch for ch in s if ch.isalpha())

def lev(a: str, b: str) -> int:
    m, n = len(a), len(b)
    dp = list(range(n + 1))
    for i in range(1, m + 1):
        prev, dp[0] = dp[0], i
        for j in range(1, n + 1):
            cur = prev if a[i - 1] == b[j - 1] else prev + 1
            cur = min(cur, dp[j] + 1, dp[j - 1] + 1)
            prev, dp[j] = dp[j], cur
    return dp[n]

def approx(token: str, target: str) -> bool:
    a, b = only_letters(token), only_letters(target)
    if not a or not b: return False
    d = lev(a, b)
    if len(b) <= 3: return d <= 1
    return d <= 2

def is_like_nom(t: str) -> bool:
    return approx(t, "nom") or t == "nomprenom"

def is_like_prenom(t: str) -> bool:
    return approx(t, "prenom") or t == "nomprenom"

def is_like_assure(t: str) -> bool:
    return approx(t, "assure") or approx(t, "assuree") or "lassure" in t or "lassuree" in t

def is_like_malade(t: str) -> bool:
    return approx(t, "malade")

def is_nom_prenom_line(text: str) -> bool:
    txt = norm(text)
    if not txt: return False
    for bad in NEGATIVE_HINTS:
        if bad in txt: return False
    toks = [t for t in txt.split(" ") if t]
    has_nom = has_prenom = has_who = False
    for t in toks:
        if not has_nom and is_like_nom(t): has_nom = True
        elif not has_prenom and is_like_prenom(t): has_prenom = True
        elif not has_who and (is_like_assure(t) or is_like_malade(t)): has_who = True
    return (has_nom and has_prenom) or ((has_nom or has_prenom) and has_who)

def quad_to_bbox(quad):
    xs = [p[0] for p in quad]
    ys = [p[1] for p in quad]
    return min(xs), min(ys), max(xs), max(ys)

def merge_bands(bands):
    # bands: list of dict {x,y,w,h}
    if not bands: return []
    bands.sort(key=lambda b: b["y"])
    merged = [bands[0]]
    for c in bands[1:]:
        last = merged[-1]
        if c["y"] <= last["y"] + last["h"] * 0.6:
            y = min(last["y"], c["y"])
            h = max(last["y"] + last["h"], c["y"] + c["h"]) - y
            merged[-1] = { "x": 0, "y": y, "w": last["w"], "h": h }
        else:
            merged.append(c)
    return merged

@app.get("/healthz")
def health():
    return {"ok": True}

@app.post("/api/ocr/paddle")
async def ocr_paddle(file: UploadFile = File(...)) -> Dict[str, Any]:
    # Charge l'image
    img_bytes = await file.read()
    image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    W, H = image.size
    img_bgr = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

    # OCR
    results = ocr.ocr(img_bgr, cls=True)
    lines = results[0] if isinstance(results, list) and results else []

    # Cherche les lignes "Nom / Prénom ... (Assuré|Malade)"
    marginY = int(round(H * MARGIN_Y))
    candidates = []
    debug_lines = []

    for ln in lines:
        quad = ln[0]                     # [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
        txt  = ln[1][0]                  # str
        conf = float(ln[1][1])           # score [0..1]
        x0, y0, x1, y1 = quad_to_bbox(quad)
        debug_lines.append({"text": txt, "bbox": [x0, y0, x1, y1], "conf": conf})

        if not is_nom_prenom_line(txt):
            continue
        # ancre à gauche
        left_ratio = x0 / float(W)
        if left_ratio > LEFT_ANCHOR_MAX_X:
            continue

        y = max(0, int(round(y0)) - marginY)
        h = min(H - y, int(round(y1 - y0)) + 2 * marginY)
        candidates.append({"x": 0, "y": y, "w": W, "h": h})

    bands = merge_bands(candidates)

    # Normalise 0..1 pour le front
    masks = [
        {
            "x": b["x"] / W,
            "y": b["y"] / H,
            "width": b["w"] / W,
            "height": b["h"] / H,
            "normalized": True,
            "label": "nom_prenom_assure"
        }
        for b in bands
    ]

    return {
        "masks": masks,
        "debug": {
            "image_size": [W, H],
            "candidates": candidates,
            "lines": debug_lines
        }
    }
