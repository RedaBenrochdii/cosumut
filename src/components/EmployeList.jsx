// src/components/EmployeList.jsx
import React, { useEffect, useState } from 'react';
import api from '../services/api';

function EmployeList() {
  const [employes, setEmployes] = useState([]);
  const isLoggedIn = localStorage.getItem('loggedIn') === 'true';

  useEffect(() => {
    if (!isLoggedIn) return;

    api.get('/employes')
      .then((res) => setEmployes(res.data))
      .catch((err) => console.error('Erreur API:', err));
  }, [isLoggedIn]);

  if (!isLoggedIn) return null;

return null; // temporairement désactivé pour ne pas polluer la vue

}

export default EmployeList;
