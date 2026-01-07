import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Document upload
export const uploadDocument = async (file) => {
  console.log('API: Starting upload for file:', file.name);
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    console.log('API: Upload response:', response.data);
    return response.data;
  } catch (error) {
    console.error('API: Upload error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      url: error.config?.url
    });
    throw error;
  }
};

// Get contracts
export const getContracts = async (skip = 0, limit = 100) => {
  const response = await api.get(`/contracts?skip=${skip}&limit=${limit}`);
  return response.data;
};

// Get contract by ID
export const getContract = async (id) => {
  const response = await api.get(`/contracts/${id}`);
  return response.data;
};

// Search contracts
export const searchContracts = async (query, limit = 10) => {
  const response = await api.post('/search', { query, limit });
  return response.data;
};

// Review contract
export const reviewContract = async (id, reviewed = true) => {
  const response = await api.post(`/contracts/${id}/review?reviewed=${reviewed}`);
  return response.data;
};

