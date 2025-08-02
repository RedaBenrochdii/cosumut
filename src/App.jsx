import React, { useState, useEffect } from 'react'; // <-- Mettre à jour les imports
import { Routes, Route, useLocation } from 'react-router-dom';

// Vos pages et composants
import LoginPage from './pages/LoginPage';
import FormPage from './pages/FormPage';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import DocumentsReceived from './pages/DocumentsReceived';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import BordereauPage from './pages/BordereauPage';
import ReclamationPage from './pages/ReclamationPage';
import LogoLoader from './components/LogoLoader'; // <-- Importer le LogoLoader

import './index.css';

const App = () => {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  // --- LOGIQUE MANQUANTE AJOUTÉE ICI ---
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true); // Active le loader à chaque changement de page
    const timer = setTimeout(() => setLoading(false), 800); // Durée de l'animation
    return () => clearTimeout(timer); // Nettoyage
  }, [location.pathname]); // Se déclenche quand l'URL change
  // ------------------------------------

  // Si l'application est en chargement, on affiche uniquement le loader
  if (loading) {
    return <LogoLoader />;
  }

  // Sinon, on affiche l'application normalement
  return (
    <div style={{ display: 'flex', width: '100%' }}>
      {!isLoginPage && <Sidebar />}

      <main
        className="pageContent"
        style={{
          flex: 1,
          paddingLeft: !isLoginPage ? '220px' : '0px',
          paddingRight: '20px',
          transition: 'padding 0.3s ease'
        }}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
          <Route path="/form" element={<PrivateRoute><FormPage /></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><DocumentsReceived /></PrivateRoute>} />
          <Route path="/bordereau" element={<PrivateRoute><BordereauPage /></PrivateRoute>} />
          <Route path="/reclamation" element={<AdminRoute><ReclamationPage /></AdminRoute>} />
        </Routes>
      </main>
    </div>
  );
};

export default App;
