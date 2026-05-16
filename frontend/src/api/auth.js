// Relative URLs — proxied via vite.config.js
const AUTH_BASE = '/api/v1/auth';
const CASE_BASE = '';  // /cases goes through proxy to localhost:4000

async function request(url, options = {}) {
  const token = localStorage.getItem('sdes_token');
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || 'Request failed');
  return data;
}

export async function loginUser({ email, password }) {
  return request(`${AUTH_BASE}/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function loginAdmin({ email, password }) {
  return request(`${AUTH_BASE}/admin/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function registerAdmin({ name, email, password, orgName }) {
  return request(`${AUTH_BASE}/admin/register`, {
    method: 'POST',
    body: JSON.stringify({ name, email, password, org_name: orgName }),
  });
}

export async function createMember({ name, email, password, role }) {
  return request(`${AUTH_BASE}/admin/create-user`, {
    method: 'POST',
    body: JSON.stringify({ name, email, password, role: role || 'user' }),
  });
}

export async function getCases() {
  return request(`${CASE_BASE}/cases`);
}

export async function createCase({ title, description }) {
  return request(`${CASE_BASE}/cases`, {
    method: 'POST',
    body: JSON.stringify({ title, description }),
  });
}

export async function getCaseById(id) {
  return request(`${CASE_BASE}/cases/${id}`);
}

export async function assignUserToCase({ caseId, userId, role }) {
  return request(`${CASE_BASE}/cases/${caseId}/users`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, role }),
  });
}

export async function getCaseUsers(caseId) {
  return request(`${CASE_BASE}/cases/${caseId}/users`);
}

