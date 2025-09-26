import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import styles from '../styles/Login.module.css';
import Logo from '../assets/logo-sidebar.png';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(''); // Reset error message

    try {
      const res = await axios.post('http://localhost:4000/api/login', { 
        username, 
        password 
      });
      
      if (res.data.success) {
        // Stockage des informations d'authentification
        localStorage.setItem('loggedIn', 'true');
        localStorage.setItem('userRole', res.data.role);
        localStorage.setItem('token', res.data.token);
        
        // Redirection vers le dashboard
        navigate('/');
      } else {
        setError('Identifiants invalides');
      }
    } catch (error) {
      // Gestion des erreurs plus précise
      if (error.response?.status === 401) {
        setError('Nom d\'utilisateur ou mot de passe incorrect');
      } else if (error.response?.status === 500) {
        setError('Erreur serveur. Veuillez réessayer plus tard.');
      } else if (error.code === 'ECONNREFUSED') {
        setError('Impossible de se connecter au serveur');
      } else {
        setError('Erreur lors de l\'authentification');
      }
      console.error('Erreur login:', error);
    } finally {
      setLoading(false);
    }
  };

  // Nettoyage localStorage au chargement (sécurité)
  React.useEffect(() => {
    localStorage.removeItem('loggedIn');
    localStorage.removeItem('userRole');
    localStorage.removeItem('token');
  }, []);

  return (
    <div className={styles.loginContainer}>
      <form className={styles.loginForm} onSubmit={handleSubmit}>
        <img src={Logo} alt="COSUMAR" className={styles.logo} />
        <h1 className={styles.title}>Connexion</h1>
        
        {error && (
          <div className={styles.errorMessage}>
            {error}
          </div>
        )}
        
        <input
          type="text"
          placeholder="Nom d'utilisateur"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          disabled={loading}
          autoComplete="username"
        />
        
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
          autoComplete="current-password"
        />
        
        <button type="submit" disabled={loading || !username || !password}>
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}
