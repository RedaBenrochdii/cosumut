import api from './api';

export const login = async (username, password) => {
  try {
    const res = await api.post('/login', { username, password });
    return res.data; // { success: true }
  } catch (err) {
    return { success: false, message: err.response?.data?.message || 'Erreur inconnue' };
  }
};
