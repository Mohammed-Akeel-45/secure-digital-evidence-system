// Relative URLs — proxied via vite.config.js
const AUTH_BASE = "/api/v1/auth";
const CASE_BASE = ""; // /cases goes through proxy to localhost:4000

async function request(url, options = {}) {
  const token = localStorage.getItem("sdes_token");
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });

  const text = await res.text();

  let data = {};
  try {
    data = JSON.parse(text);
  } catch {}

  if (!res.ok) {
    throw new Error(text || "Request failed");
  }

  return data;
}

export async function loginUser({ email, password }) {
  return request(`${AUTH_BASE}/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function loginAdmin({ email, password }) {
  return request(`${AUTH_BASE}/admin/login`, {
    method: "POST",
    body: JSON.stringify({ admin_email: email, admin_password: password }),
  });
}

export async function registerAdmin({ name, email, password, orgName }) {
  return request(`${AUTH_BASE}/admin/register`, {
    method: "POST",
    body: JSON.stringify({
      admin_name: name,
      admin_email: email,
      admin_password: password,
      org_name: orgName,
    }),
  });
}

export async function createMember({ name, email, password, role }) {
  return request(`${AUTH_BASE}/admin/create-user`, {
    method: "POST",
    body: JSON.stringify({ name, email, password, role }),
  });
}

export async function getCases() {
  return request(`${CASE_BASE}/cases`);
}

export async function getOrgUsers() {
  return request(`${AUTH_BASE}/admin/get-org-users`);
}

export async function createDepartment({ name }) {
  return request(`${AUTH_BASE}/admin/create-department`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function createRole({ name, description, permissions }) {
  return request(`${AUTH_BASE}/create-role`, {
    method: "POST",
    body: JSON.stringify({ name, description, permissions }),
  });
}

export async function deleteRole(roleName) {
  return request(`${AUTH_BASE}/delete-role`, {
    method: "POST",
    body: JSON.stringify({ name: roleName }),
  });
}

export async function getAllPermissions() {
  return request(`${AUTH_BASE}/get-all-permissions`);
}

export async function getRolePermissions(roleName) {
  return request(`${AUTH_BASE}/get-role-permissions/${roleName}`);
}

export async function getOrgRoles() {
  return request(`${AUTH_BASE}/get-org-roles`);
}

export async function getUserRoles(userId) {
  return request(`${AUTH_BASE}/get-user-roles/${userId}`);
}

export async function getOrgDepartments() {
  return request(`${AUTH_BASE}/admin/get-org-departments`);
}

export async function updateUserDepartment({ userId, departmentId }) {
  return request(`${AUTH_BASE}/admin/update-user-department`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, department_id: departmentId }),
  });
}

export async function deleteDepartment({ departmentId }) {
  return request(`${AUTH_BASE}/admin/delete-department`, {
    method: "POST",
    body: JSON.stringify({ department_id: departmentId }),
  });
}

export async function createCase({ title, description, priority }) {
  return request(`${CASE_BASE}/cases`, {
    method: "POST",
    body: JSON.stringify({ title, description, priority }),
  });
}

export async function getCaseById(id) {
  return request(`${CASE_BASE}/cases/${id}`);
}

export async function assignUserToCase({ caseId, userId, role }) {
  return request(`${CASE_BASE}/cases/${caseId}/users`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, role }),
  });
}

export async function getCaseUsers(caseId) {
  return request(`${CASE_BASE}/cases/${caseId}/users`);
}
