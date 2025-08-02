import React from 'react';
import { Navigate } from 'react-router-dom';

const AdminRoute = ({ children }) => {
  const isLoggedIn = localStorage.getItem('loggedIn') === 'true';
  const userRole = localStorage.getItem('userRole');

  // Si l'utilisateur n'est pas connecté, on le renvoie à la page de connexion
  if (!isLoggedIn) {
    return <Navigate to="/login" />;
  }

  // Si l'utilisateur est un admin, on affiche la page. Sinon, on le renvoie à l'accueil.
  return userRole === 'admin' ? children : <Navigate to="/" />;
};

export default AdminRoute;