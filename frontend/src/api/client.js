const API_BASE = '/api';

async function fetchJson(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`API call failed: ${url}`, error);
    throw error;
  }
}

export const api = {
  // Incidents
  getIncidents: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchJson(`${API_BASE}/incidents?${query}`);
  },

  getIncident: (id) => fetchJson(`${API_BASE}/incidents/${id}`),

  getActive: () => fetchJson(`${API_BASE}/active`),

  getHotspots: (limit = 20) => fetchJson(`${API_BASE}/hotspots?limit=${limit}`),

  getStats: () => fetchJson(`${API_BASE}/stats`),

  // Forecast
  postForecast: (data) =>
    fetchJson(`${API_BASE}/forecast`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Gravity
  getGravity: (lat, lng, datetime) => {
    const params = new URLSearchParams({ lat, lng, datetime: datetime || '' });
    return fetchJson(`${API_BASE}/gravity?${params}`);
  },

  getPois: (datetime) => {
    const params = datetime ? `?datetime=${datetime}` : '';
    return fetchJson(`${API_BASE}/pois${params}`);
  },

  // Cascade
  postCascade: (data) =>
    fetchJson(`${API_BASE}/cascade`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getCorridors: () => fetchJson(`${API_BASE}/corridors`),

  // Calendar
  getCalendarRisk: (date, zone) => {
    const params = new URLSearchParams({ date });
    if (zone) params.append('zone', zone);
    return fetchJson(`${API_BASE}/calendar-risk?${params}`);
  },

  getCalendarEvents: () => fetchJson(`${API_BASE}/calendar-events`),

  getMonthlyEvents: (year, month) =>
    fetchJson(`${API_BASE}/calendar-monthly?year=${year}&month=${month}`),

  // LLM Recommendations
  postRecommend: (data) =>
    fetchJson(`${API_BASE}/recommend`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
