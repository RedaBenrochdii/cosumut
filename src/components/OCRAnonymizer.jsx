import React, { useState, useRef } from 'react';
import Tesseract from 'tesseract.js';

// Main App component for the sickness declaration form with Tesseract OCR for local redaction
export default function App() {
  // State for form data, file handling, and application status
  const [formData, setFormData] = useState({
    contractNumber: '',
    affiliationNumber: '',
    matriculeSte: '',
    assuredName: '',
    dossierNumber: '',
    declarationType: 'Médical',
    totalFees: '',
    consultationDate: '',
    familyLink: '',
    patientName: '',
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [anonymizedUrl, setAnonymizedUrl] = useState('');
  const [status, setStatus] = useState('En attente de document...');
  const [processing, setProcessing] = useState(false);
  const canvasRef = useRef(null);

  // Labels to identify and anonymize
  const FIELD_LABELS = [
    "Nom et prénom de l'assuré",
    "Nom et prénom de l’assuré",
    "Nom & prénom de l'assuré"
  ];

  // Handle changes in form inputs
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({ ...prevData, [name]: value }));
  };

  // Handle file selection and preview
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setAnonymizedUrl('');
    setFormData(prevData => ({ ...prevData, assuredName: '' }));
    setStatus('Image sélectionnée. Prêt à anonymiser.');
  };

  /**
   * Performs local OCR with Tesseract.js to find and redact sensitive information.
   * This function redraws the image and applies a black rectangle over the identified text.
   */
  const handleAnonymize = async () => {
    if (!selectedFile || !previewUrl) {
      setStatus('Veuillez d\'abord sélectionner une image.');
      return;
    }
    setProcessing(true);
    setStatus('Analyse OCR locale en cours...');

    const img = new window.Image();
    img.src = previewUrl;
    await new Promise(res => { img.onload = res; });

    const canvas = canvasRef.current;
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    
    // Draw the original image onto the canvas
    ctx.drawImage(img, 0, 0, img.width, img.height);
    
    // Run Tesseract OCR on the original image
    const { data: { lines } } = await Tesseract.recognize(img, 'fra', { logger: () => {} });

    let anonymized = false;
    lines.forEach(line => {
      const lineText = line.text.trim().toLowerCase();
      // Check if the line text contains one of the target labels
      if (FIELD_LABELS.some(label => lineText.includes(label.toLowerCase()))) {
        // If the label is found, redact the area right next to it, where the name is
        const { x0, y0, x1, y1 } = line.bbox;
        
        // This is the correct logic: redact the area from the end of the label to the right side of the image
        // The coordinate x0 here corresponds to the start of the line "Nom et prénom de l'assuré"
        // We want to mask the content *after* this label, in the same horizontal line.
        // The code below draws a rectangle from the end of the bounding box to the right edge.
        // Let's refine this to be more precise based on a potential second word after the label.
        // A more reliable approach is to redact the *entire line* to be safe, especially given the prompt.
        
        // To be 100% sure the name is redacted, we'll draw a rectangle over the entire bounding box of the line
        // plus a small margin.
        ctx.fillStyle = "#000000";
        ctx.fillRect(x0 - 4, y0 - 4, (x1 - x0) + 8, (y1 - y0) + 8);
        
        anonymized = true;
      }
    });

    const anonymizedBase64 = canvas.toDataURL('image/jpeg', 0.95);
    setAnonymizedUrl(anonymizedBase64);

    if (anonymized) {
      setStatus('Anonymisation terminée. Vous pouvez maintenant l\'envoyer à Gemini.');
    } else {
      setStatus('Aucune information à anonymiser trouvée. Prêt à l\'envoyer à Gemini.');
    }
    setProcessing(false);
  };

  /**
   * Sends the anonymized image to the Gemini API for structured data extraction.
   * This function uses the Gemini API to extract form data from the anonymized image.
   */
  const handleSendToGemini = async () => {
    if (!anonymizedUrl) {
      setStatus('Veuillez d\'abord anonymiser l\'image.');
      return;
    }
    setProcessing(true);
    setStatus('Envoi de l\'image anonymisée à Gemini...');

    const base64ImageData = anonymizedUrl.split(',')[1];
    
    // Prompt the model to extract information from the anonymized image.
    // The prompt explicitly tells the model to ignore redacted data.
    const prompt = `Extrait les informations suivantes de ce document anonymisé et renvoie-les sous forme de JSON. Les champs à extraire sont: 'contractNumber', 'affiliationNumber', 'matriculeSte', 'dossierNumber', 'totalFees', 'consultationDate', 'patientName'. Pour les "radio buttons", extraie le "lien de parenté" parmi "lui-même", "conjoint", "enfants". Ne réponds qu'avec l'objet JSON, sans aucun texte supplémentaire. Ignore les données qui semblent floutées ou anonymisées.`;
    
    const chatHistory = [{
      role: "user",
      parts: [{ text: prompt }, {
        inlineData: {
          mimeType: selectedFile.type,
          data: base64ImageData
        }
      }]
    }];

    const payload = {
      contents: chatHistory,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            "contractNumber": { "type": "STRING" },
            "affiliationNumber": { "type": "STRING" },
            "matriculeSte": { "type": "STRING" },
            "dossierNumber": { "type": "STRING" },
            "totalFees": { "type": "STRING" },
            "consultationDate": { "type": "STRING" },
            "patientName": { "type": "STRING" },
            "familyLink": { "type": "STRING" }
          }
        }
      }
    };

    const apiKey = "";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      const jsonText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (jsonText) {
        const parsedJson = JSON.parse(jsonText);
        setFormData(prevData => ({ ...prevData, ...parsedJson }));
        setStatus('Données extraites avec succès et formulaire pré-rempli.');
      } else {
        setStatus('Échec de l\'extraction des données du formulaire. Réessayez avec une image plus claire.');
      }
    } catch (error) {
      console.error('Erreur lors de l\'extraction des données:', error);
      setStatus('Une erreur est survenue lors de l\'extraction.');
    } finally {
      setProcessing(false);
    }
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    setStatus('Déclaration soumise avec succès !');
    console.log('Formulaire soumis:', formData);
  };

  return (
    <div className="flex min-h-screen font-inter bg-gray-100 text-gray-800">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-lg p-6 flex flex-col rounded-r-3xl">
        <div className="flex items-center mb-10">
          <img src="https://placehold.co/40x40/0177b9/ffffff?text=C" alt="COSUMAR Logo" className="h-10 w-10 mr-3 rounded-full" />
          <div className="text-xl font-bold text-gray-800">COSUMAR</div>
        </div>
        <nav className="flex-1">
          <ul>
            <li><a href="#" className="flex items-center p-3 text-gray-600 hover:bg-blue-100 hover:text-blue-600 rounded-lg transition-colors">Accueil</a></li>
            <li><a href="#" className="flex items-center p-3 text-gray-600 hover:bg-blue-100 hover:text-blue-600 rounded-lg transition-colors">Documents reçus</a></li>
            <li><a href="#" className="flex items-center p-3 text-blue-600 bg-blue-100 rounded-lg font-medium">Formulaire</a></li>
            <li><a href="#" className="flex items-center p-3 text-gray-600 hover:bg-blue-100 hover:text-blue-600 rounded-lg transition-colors">Production</a></li>
            <li><a href="#" className="flex items-center p-3 text-gray-600 hover:bg-blue-100 hover:text-blue-600 rounded-lg transition-colors">Bordereau</a></li>
          </ul>
        </nav>
        <div className="mt-auto">
          <a href="#" className="flex items-center p-3 text-gray-600 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors">Se déconnecter</a>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8">
        <header className="flex justify-between items-center pb-4 mb-8 border-b-2 border-gray-200">
          <h1 className="text-2xl font-bold">Déclaration de Maladie</h1>
        </header>

        <div className="bg-white p-6 rounded-3xl shadow-xl max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* OCR & Anonymization Section */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <h2 className="text-xl font-semibold mb-2">Scan de Document (OCR)</h2>
              <p className="text-sm text-gray-500 mb-4">Anonymiser localement, puis analyser avec Gemini :</p>
              
              <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
                <div className="flex-1 flex flex-col space-y-2">
                  <label htmlFor="file-upload" className="bg-blue-500 text-white font-medium py-2 px-4 rounded-lg cursor-pointer hover:bg-blue-600 transition-colors text-center">
                    Choisir un fichier
                  </label>
                  <input id="file-upload" type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={processing} />
                  <span className="text-gray-500 text-sm truncate">{selectedFile ? selectedFile.name : 'Aucun fichier choisi'}</span>
                </div>
                
                <div className="flex-1 flex space-x-2">
                  <button type="button" onClick={handleAnonymize} disabled={!selectedFile || processing} className="flex-1 bg-yellow-500 text-white font-medium py-2 px-4 rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50">
                    1. Anonymiser (Local)
                  </button>
                  <button type="button" onClick={handleSendToGemini} disabled={!anonymizedUrl || processing} className="flex-1 bg-green-500 text-white font-medium py-2 px-4 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50">
                    2. Envoyer à Gemini
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-col md:flex-row md:space-x-4">
                {previewUrl && (
                  <div className="flex-1 mb-4 md:mb-0">
                    <h3 className="font-medium mb-2">Aperçu original :</h3>
                    <img src={previewUrl} alt="Aperçu du document original" className="max-w-full max-h-64 rounded-lg shadow-md border" />
                  </div>
                )}
                {anonymizedUrl && (
                  <div className="flex-1">
                    <h3 className="font-medium mb-2">Aperçu anonymisé :</h3>
                    <img src={anonymizedUrl} alt="Aperçu du document anonymisé" className="max-w-full max-h-64 rounded-lg shadow-md border" />
                  </div>
                )}
              </div>
              
              {/* Invisible canvas used for image processing */}
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              <div className="mt-4">
                <h3 className="font-medium">Statut :</h3>
                <div id="ocr-status" className={`mt-2 p-3 bg-white border rounded-lg h-12 flex items-center overflow-auto ${processing ? 'animate-pulse text-blue-500' : 'text-gray-800'}`}>
                  {status}
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Informations Assuré</h2>
              <div className="space-y-4">
                <div className="flex items-center">
                  <label htmlFor="contractNumber" className="w-1/3 font-medium">N° du contrat :</label>
                  <input type="text" id="contractNumber" name="contractNumber" value={formData.contractNumber} onChange={handleInputChange} className="flex-1 p-2 border rounded-lg" placeholder="Entrez le numéro de contrat" />
                </div>
                <div className="flex items-center">
                  <label htmlFor="affiliationNumber" className="w-1/3 font-medium">N° d'affiliation :</label>
                  <input type="text" id="affiliationNumber" name="affiliationNumber" value={formData.affiliationNumber} onChange={handleInputChange} className="flex-1 p-2 border rounded-lg" placeholder="Entrez le numéro d'affiliation" />
                </div>
                <div className="flex items-center">
                  <label htmlFor="matriculeSte" className="w-1/3 font-medium">Matricule Ste :</label>
                  <input type="text" id="matriculeSte" name="matriculeSte" value={formData.matriculeSte} onChange={handleInputChange} className="flex-1 p-2 border rounded-lg" placeholder="Entrez le matricule" />
                </div>
                <div className="flex items-center">
                  <label htmlFor="assuredName" className="w-1/3 font-medium">Nom et prénom de l'assuré :</label>
                  <input type="text" id="assuredName" name="assuredName" value={formData.assuredName} onChange={handleInputChange} className="flex-1 p-2 border rounded-lg" placeholder="Entrez le nom et prénom" />
                </div>
                <div className="flex items-center">
                  <label htmlFor="dossierNumber" className="w-1/3 font-medium">Numéro du Dossier :</label>
                  <input type="text" id="dossierNumber" name="dossierNumber" value={formData.dossierNumber} onChange={handleInputChange} className="flex-1 p-2 border rounded-lg" placeholder="Entrez le numéro du dossier" />
                </div>
              </div>
            </div>

            {/* Declaration Details Section */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Détails de la Déclaration</h2>
              <div className="space-y-4">
                <div className="flex items-center">
                  <label htmlFor="declarationType" className="w-1/3 font-medium">Type de déclaration :</label>
                  <select id="declarationType" name="declarationType" value={formData.declarationType} onChange={handleInputChange} className="flex-1 p-2 border rounded-lg">
                    <option>Médical</option>
                    <option>Dentaire</option>
                    <option>Optique</option>
                  </select>
                </div>
                <div className="flex items-center">
                  <label htmlFor="totalFees" className="w-1/3 font-medium">Total des frais engagés :</label>
                  <input type="number" id="totalFees" name="totalFees" value={formData.totalFees} onChange={handleInputChange} className="flex-1 p-2 border rounded-lg" placeholder="Entrez le total des frais" />
                </div>
                <div className="flex items-center">
                  <label htmlFor="consultationDate" className="w-1/3 font-medium">Date de la consultation :</label>
                  <input type="date" id="consultationDate" name="consultationDate" value={formData.consultationDate} onChange={handleInputChange} className="flex-1 p-2 border rounded-lg" />
                </div>
              </div>
            </div>

            {/* Patient Information Section */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Informations Malade</h2>
              <div className="space-y-4">
                <div className="flex items-center">
                  <label className="w-1/3 font-medium">Lien de parenté :</label>
                  <div className="flex flex-1 space-x-4">
                    <label className="flex items-center"><input type="radio" name="familyLink" value="lui-même" checked={formData.familyLink === 'lui-même'} onChange={handleInputChange} className="text-blue-500" /> <span className="ml-2">Lui-même</span></label>
                    <label className="flex items-center"><input type="radio" name="familyLink" value="conjoint" checked={formData.familyLink === 'conjoint'} onChange={handleInputChange} className="text-blue-500" /> <span className="ml-2">Conjoint</span></label>
                    <label className="flex items-center"><input type="radio" name="familyLink" value="enfants" checked={formData.familyLink === 'enfants'} onChange={handleInputChange} className="text-blue-500" /> <span className="ml-2">Enfants</span></label>
                  </div>
                </div>
                <div className="flex items-center">
                  <label htmlFor="patientName" className="w-1/3 font-medium">Nom et prénom du malade :</label>
                  <input type="text" id="patientName" name="patientName" value={formData.patientName} onChange={handleInputChange} className="flex-1 p-2 border rounded-lg" placeholder="Entrez le nom et prénom" />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4">
              <button type="submit" className="bg-green-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-600 transition-colors shadow-lg" disabled={processing}>
                Valider la Déclaration
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

