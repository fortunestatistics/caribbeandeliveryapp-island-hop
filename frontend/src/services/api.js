import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register');
    // Only force a redirect for expired/invalid sessions on protected requests.
    // A 401 from the login/register call itself should surface an inline error.
    if (error.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email, origin_url: window.location.origin }),
  resetPassword: (token, newPassword) => api.post('/auth/reset-password', { token, new_password: newPassword }),
  updateProfile: (data) => api.put('/users/me', data),
};

export const reviewAPI = {
  getMerchantReviews: (merchantId) => api.get(`/merchants/${merchantId}/reviews`),
  createMerchantReview: (merchantId, data) => api.post(`/merchants/${merchantId}/reviews`, data),
  replyMerchantReview: (merchantId, reviewId, reply) => api.post(`/merchants/${merchantId}/reviews/${reviewId}/reply`, { reply }),
};

// Order API
export const orderAPI = {
  create: (data) => api.post('/orders/create', data),
  getById: (orderId) => api.get(`/orders/${orderId}`),
  updateStatus: (orderId, data) => api.put(`/orders/${orderId}/status`, data),
  getUserHistory: (limit = 20, skip = 0) => api.get(`/orders/user/history?limit=${limit}&skip=${skip}`),
};

// Chat API
export const chatAPI = {
  sendMessage: (data) => api.post('/chat/send', data),
  getMessages: (orderId) => api.get(`/chat/${orderId}/messages`),
};

// Payment API
export const paymentAPI = {
  createPaymentIntent: (amount, currency = 'usd') => api.post('/payments/create-payment-intent', { amount, currency }),
  confirmPayment: (paymentIntentId, orderId) => api.post('/payments/confirm-payment', { payment_intent_id: paymentIntentId, order_id: orderId }),
};

// Subscription API
export const subscriptionAPI = {
  getPlans: (userType = 'business') => api.get(`/subscriptions/plans?user_type=${userType}`),
  subscribe: (data) => api.post('/subscriptions/subscribe', data),
};

// Restaurant API
export const restaurantAPI = {
  getAll: () => api.get('/restaurants'),
  getById: (id) => api.get(`/restaurants/${id}`),
  create: (data) => api.post('/restaurants', data),
};

// WebSocket connection
export const createWebSocket = (userId, onMessage) => {
  const wsUrl = process.env.REACT_APP_BACKEND_URL.replace('http', 'ws') + `/ws/${userId}`;
  const ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    // WebSocket connected
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  ws.onclose = () => {
    // Attempt to reconnect after 5 seconds
    setTimeout(() => {
      if (userId) {
        createWebSocket(userId, onMessage);
      }
    }, 5000);
  };
  
  return ws;
};

export default api;
