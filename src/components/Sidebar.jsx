import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import styles from '../styles/Sidebar.module.css'; // Assurez-vous que le chemin est correct
import logo from '../assets/logo-sidebar.png'; // Assurez-vous que le chemin est correct

const Sidebar = () => {
  const navigate = useNavigate();
  const userRole = localStorage.getItem('userRole'); // Récupère le rôle de l'utilisateur

  const handleLogout = () => {
    localStorage.removeItem('loggedIn');
    localStorage.removeItem('userRole'); // Nettoie le rôle à la déconnexion
    navigate('/login');
  };

  return (
    <nav className={styles.sidebar}>
      <div className={styles.logoContainer}>
        <img src={logo} alt="Logo" className={styles.logo} />
      </div>
      <ul className={styles.menu}>
        <li>
          <NavLink to="/" className={({ isActive }) => (isActive ? styles.active : undefined)}>
            Accueil
          </NavLink>
        </li>
      
        <li>
          <NavLink to="/form" className={({ isActive }) => (isActive ? styles.active : undefined)}>
            Formulaire
          </NavLink>
        </li>
        
        {/* Le lien "Production" ne s'affiche que si l'utilisateur est un admin */}
        {userRole === 'admin' && (
          <li>
            <NavLink to="/reclamation" className={({ isActive }) => (isActive ? styles.active : undefined)}>
              Production
            </NavLink>
          </li>
        )}
        
        <li>
          <NavLink to="/bordereau" className={({ isActive }) => (isActive ? styles.active : undefined)}>
            Bordereau
          </NavLink>
        </li>
        <li>
          <button onClick={handleLogout} className={styles.logoutLink}>
            Se déconnecter
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default Sidebar;