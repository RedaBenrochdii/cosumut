import React, { useState } from 'react';
import axios from 'axios';

const SmartUploader = ({ onAutoFill }) => {
  const [image, setImage] = useState(null);
  const [status, setStatus] = useState('');
  const [confidence, setConfidence] = useState(null);

  const handleFileChange = (e) => {
    setImage(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!image) return;
    const formData = new FormData();
    formData.append('image', image);

    try {
      const res = await axios.post('http://localhost:4000/api/upload', formData);
      if (res.data.matchFound) {
        setStatus('✅ Match trouvé, champs remplis automatiquement !');
        setConfidence(res.data.confidenceScore);
        onAutoFill(res.data.autoFill); // Remplit les champs dans le parent
      } else {
        setStatus('❌ Aucun match trouvé.');
        setConfidence(null);
      }
    } catch (err) {
      setStatus('⚠️ Erreur lors de l\'upload.');
      console.error(err);
    }
  };

  return (
    <div className="p-4 border rounded bg-gray-50">
      <input type="file" onChange={handleFileChange} className="mb-2" />
      <button onClick={handleUpload} className="bg-blue-500 text-white px-4 py-2 rounded">
        /*Comparer et remplir/*
      </button>
      <div className="mt-2 text-sm">{status}</div>
      {confidence !== null && (
        <div className={`mt-2 p-2 rounded ${confidence > 85 ? 'bg-green-300' : confidence > 60 ? 'bg-yellow-300' : 'bg-red-300'}`}>
          Score de confiance : {confidence}%
        </div>
      )}
    </div>
  );
};

export default SmartUploader;
