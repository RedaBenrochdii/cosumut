import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import styles from '../styles/Login.module.css'; // Assurez-vous que le chemin est correct
import Logo from '../assets/logo-sidebar.png'; // Assurez-vous que le chemin est correct

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await axios.post('http://localhost:4000/api/login', { username, password });
      
      if (res.data.success) {
        localStorage.setItem('loggedIn', 'true');
        localStorage.setItem('userRole', res.data.role); // <-- On sauvegarde le rôle
        navigate('/');
      } else {
        alert('Identifiants invalides');
      }
    } catch (error) {
      alert("Erreur lors de l'authentification");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <form className={styles.loginForm} onSubmit={handleSubmit}>
        <img src={Logo} alt="COSUMAR" className={styles.logo} />
        <h1 className={styles.title}>Connexion</h1>
        <input
          type="text"
          placeholder="Nom d'utilisateur"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          disabled={loading}
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}