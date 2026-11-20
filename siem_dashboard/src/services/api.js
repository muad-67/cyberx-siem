/**
 * services/api.js
 * All API calls to the CyberX SIEM Flask backend.
 * Change BASE_URL here if the SOC server IP changes.
 */

import axios from 'axios';

// When running on the SOC VM, change this to http://192.168.1.10:5000
const BASE_URL = process.env.REACT_APP_SIEM_URL || 'http://127.0.0.1:5000';

const api = axios.create({ baseURL: BASE_URL, timeout: 10000 });

// Attach JWT token from localStorage to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('cyberx_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login    = (username, password) =>
  api.post('/api/auth/login', { username, password }).then(r => r.data);
export const register = (username, email, password, role) =>
  api.post('/api/auth/register', { username, email, password, role }).then(r => r.data);
export const fetchMe  = () => api.get('/api/auth/me').then(r => r.data);

// ── Logs ──────────────────────────────────────────────────────────────────────
export const fetchLogs        = (params = {}) => api.get('/api/logs', { params }).then(r => r.data);
export const fetchAlerts      = (params = {}) => api.get('/api/alerts', { params }).then(r => r.data);

// ── Stats ─────────────────────────────────────────────────────────────────────
export const fetchOverview    = ()             => api.get('/api/stats/overview').then(r => r.data);
export const fetchTopIPs      = ()             => api.get('/api/stats/top-ips').then(r => r.data);
export const fetchAlertsByType = ()            => api.get('/api/stats/alerts-by-type').then(r => r.data);
export const fetchHourlyLogs  = (hours = 24)   => api.get('/api/stats/hourly-logs', { params: { hours } }).then(r => r.data);

// ── MITRE ─────────────────────────────────────────────────────────────────────
export const fetchTopCountries    = ()         => api.get('/api/stats/top-countries').then(r => r.data);
export const fetchMitreSummary    = ()         => api.get('/api/mitre/summary').then(r => r.data);
export const fetchMitreTechniques = ()         => api.get('/api/mitre/techniques').then(r => r.data);

// ── Alert management ──────────────────────────────────────────────────────────
export const updateAlertStatus   = (id, status) =>
  api.put(`/api/alerts/${id}/status`, { status }).then(r => r.data);
export const fetchIncidentReport = (id)         =>
  api.get(`/api/report/incident/${id}`).then(r => r.data);
export const createIncident      = (data)       =>
  api.post('/api/incidents', data).then(r => r.data);

// ── Response ──────────────────────────────────────────────────────────────────
export const blockIP          = (ip, reason, alertId) =>
  api.post('/api/response/block-ip', { ip_address: ip, reason, alert_id: alertId }).then(r => r.data);
export const fetchBlockedIPs  = ()              => api.get('/api/response/blocked-ips').then(r => r.data);

export const addToWatchlist     = (ip, reason)  =>
  api.post('/api/response/watchlist', { ip_address: ip, reason }).then(r => r.data);
export const fetchWatchlist     = ()            => api.get('/api/response/watchlist').then(r => r.data);
export const removeFromWatchlist = (ip)         =>
  api.delete(`/api/response/watchlist/${ip}`).then(r => r.data);

export const addToWhitelist     = (ip, reason)  =>
  api.post('/api/response/whitelist', { ip_address: ip, reason }).then(r => r.data);
export const fetchWhitelist     = ()            => api.get('/api/response/whitelist').then(r => r.data);
export const removeFromWhitelist = (ip)         =>
  api.delete(`/api/response/whitelist/${ip}`).then(r => r.data);

// ── Reports ───────────────────────────────────────────────────────────────────
export const fetchDailyReport   = (days = 1)   =>
  api.get('/api/reports/daily', { params: { days } }).then(r => r.data);
export const fetchWeeklyReport  = ()           => api.get('/api/reports/weekly').then(r => r.data);
export const fetchStorageStats  = ()           => api.get('/api/admin/storage').then(r => r.data);
export const exportAlerts = (fmt = 'json', days = 7, severity) => {
  const params = { format: fmt, days };
  if (severity) params.severity = severity;
  if (fmt === 'csv') {
    return api.get('/api/reports/export', { params, responseType: 'blob' }).then(r => r.data);
  }
  return api.get('/api/reports/export', { params }).then(r => r.data);
};

// ── Endpoints ─────────────────────────────────────────────────────────────────
export const fetchEndpoints      = ()           => api.get('/api/endpoints').then(r => r.data);
export const fetchEndpointStats  = ()           => api.get('/api/endpoints/stats').then(r => r.data);
export const fetchEndpointDetail = (hostname)   => api.get(`/api/endpoints/${encodeURIComponent(hostname)}`).then(r => r.data);

// ── Threat Intelligence ───────────────────────────────────────────────────────
export const checkThreatIntel    = (ip)         => api.get(`/api/threat-intel/${ip}`).then(r => r.data);
export const fetchTICache        = ()           => api.get('/api/threat-intel/cache').then(r => r.data);

// ── Timeline ──────────────────────────────────────────────────────────────────
export const fetchTimeline       = (ip, hours = 24) =>
  api.get(`/api/timeline/${ip}`, { params: { hours } }).then(r => r.data);

// ── Incidents (extended) ──────────────────────────────────────────────────────
export const fetchIncidents       = ()           => api.get('/api/incidents').then(r => r.data);
export const fetchIncidentDetail  = (id)         => api.get(`/api/incidents/${id}`).then(r => r.data);
export const updateIncident       = (id, data)   => api.put(`/api/incidents/${id}`, data).then(r => r.data);
export const addIncidentNote      = (id, data)   => api.post(`/api/incidents/${id}/notes`, data).then(r => r.data);
export const fetchIncidentNotes   = (id)         => api.get(`/api/incidents/${id}/notes`).then(r => r.data);

// ── Search ────────────────────────────────────────────────────────────────────
export const searchAll = (q) => api.get('/api/search', { params: { q } }).then(r => r.data);

// ── Detection rules ───────────────────────────────────────────────────────────
export const fetchRules  = ()          => api.get('/api/rules').then(r => r.data);
export const updateRule  = (id, data)  => api.put(`/api/rules/${id}`, data).then(r => r.data);
export const testRule    = (id, data)  => api.post(`/api/rules/${id}/test`, data).then(r => r.data);
