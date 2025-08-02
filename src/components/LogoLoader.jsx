import React from 'react';
import '../styles/LogoLoader.css';

const LogoLoader = () => {
  return (
    <div className="loader-container">
      <img 
        src="/assets/cosumar-logo-jaune.png" 
        alt="Chargement..." 
        className="loader-logo animated-logo"
      />
    </div>
  );
};

export default LogoLoader;