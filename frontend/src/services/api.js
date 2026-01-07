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

export const getContractSummary = async () => {
  const response = await api.get('/contracts/summary');
  return response.data;
};

// Get contract versions
export const getContractVersions = async (contractId) => {
  const response = await api.get(`/contracts/${contractId}/versions`);
  return response.data;
};

// Get contract deltas
export const getContractDeltas = async (contractId, versionFrom, versionTo) => {
  const params = {};
  if (versionFrom) params.version_from = versionFrom;
  if (versionTo) params.version_to = versionTo;
  
  const response = await api.get(`/contracts/${contractId}/deltas`, { params });
  return response.data;
};

// Advanced search
export const advancedSearch = async (filters) => {
  const response = await api.get('/contracts/search/advanced', { params: filters });
  return response.data;
};

// Upload with amendment info
export const uploadDocumentWithMetadata = async (file, metadata) => {
  const formData = new FormData();
  formData.append('file', file);
  
  // Add metadata as query params or form fields
  if (metadata.is_amendment) {
    formData.append('is_amendment', 'true');
    formData.append('parent_document_id', metadata.parent_document_id);
    if (metadata.amendment_type) {
      formData.append('amendment_type', metadata.amendment_type);
    }
  }
  
  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const compareContracts = async (contractId1, contractId2) => {
  const response = await api.post('/contracts/compare', {
    contract_id_1: contractId1,
    contract_id_2: contractId2
  });
  return response.data;
};
