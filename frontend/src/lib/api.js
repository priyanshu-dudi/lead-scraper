import axios from 'axios';

const BACKEND = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${BACKEND}/api`,
  timeout: 30000,
});

export const leadsApi = {
  list: (params) => api.get('/leads', { params }),
  stats: (params) => api.get('/leads/stats', { params }),
  delete: (id) => api.delete(`/leads/${id}`),
  deleteAll: (params) => api.delete('/leads', { params }),
};

export const scraperApi = {
  start: (config) => api.post('/scraper/start', config),
  stop: () => api.post('/scraper/stop'),
  pause: () => api.post('/scraper/pause'),
  resume: () => api.post('/scraper/resume'),
  status: () => api.get('/scraper/status'),
  logs: (params) => api.get('/scraper/logs', { params }),
  queue: (params) => api.get('/scraper/queue', { params }),
};

export const exportApi = {
  csv: (params) => api.post('/export/csv', params),
  json: (params) => api.post('/export/json', params),
  files: () => api.get('/export/files'),
  downloadUrl: (filename) => `/api/export/download/${filename}`,
};

export const configApi = {
  niches: () => api.get('/config/niches'),
  sources: () => api.get('/config/sources'),
  env: () => api.get('/config/env'),
};

export const healthApi = {
  check: () => api.get('/health'),
};

export default api;
