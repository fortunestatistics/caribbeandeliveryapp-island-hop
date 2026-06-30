import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const isLoggedIn = () => !!localStorage.getItem('token');

export const fetchProfile = async () => {
  try {
    const r = await axios.get(`${API}/auth/me`, { headers: authHeaders() });
    return r.data || {};
  } catch (_) {
    return {};
  }
};

export const formatProfileAddress = (address) => {
  if (!address) return '';
  return [address.street, address.city, address.country].filter(Boolean).join(', ');
};

// Creates an order in the backend and returns the created order (with id).
export const createOrder = async (payload) => {
  const r = await axios.post(`${API}/orders`, payload, { headers: authHeaders() });
  return r.data;
};
