import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    'Accept': 'application/json'
  }
});

export async function getEvents(params = {}) {
  const response = await apiClient.get('/api/events', { params });
  return response.data;
}

export async function getEvent(id) {
  const response = await apiClient.get(`/api/events/${id}`);
  return response.data;
}

export async function getCameras() {
  const response = await apiClient.get('/api/cameras');
  return response.data;
}

export async function getStats() {
  const response = await apiClient.get('/api/stats');
  return response.data;
}

export function getEvidenceUrl(filename) {
  if (!filename) return null;
  return `${API_BASE}/api/evidence/${filename}`;
}

export async function saveFence(zones) {
  const response = await apiClient.post('/api/config/fence', { zones });
  return response.data;
}

export async function getKnownFaces() {
  const response = await apiClient.get('/api/faces');
  return response.data;
}

export async function addKnownFace(formData) {
  const response = await apiClient.post('/api/faces', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
}

export async function removeKnownFace(id) {
  const response = await apiClient.delete(`/api/faces/${id}`);
  return response.data;
}

export async function checkHealth() {
  try {
    await apiClient.get('/api/stats');
    return true;
  } catch (error) {
    return false;
  }
}
