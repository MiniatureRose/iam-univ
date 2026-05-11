const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

const request = async (path, options = {}) => {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 401 && path !== '/auth/me') {
    window.location.reload();
    throw new Error('Session expirée');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Erreur requête : ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
};

export const login = (email, password) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

export const logout = async () => {
  await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
  window.location.reload();
};

export const fetchAppConfig = () =>
  fetch(`${API_BASE}/public/config`, { credentials: 'include' }).then(r => r.ok ? r.json() : Promise.reject());

export const fetchAuthMe = () => request('/auth/me');
export const fetchMe = () => request('/me');
export const fetchMyManagedGroups = () => request('/me/managed-groups');
export const updateMyContact = (data) => request('/me/contact', { method: 'PUT', body: JSON.stringify(data) });
export const changePassword = (currentPassword, newPassword) =>
  request('/me/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) });

// ─── Identities ────────────────────────────────────────────
export const fetchStats = () => request('/stats');
export const fetchIdentities = async (appRoles = []) => {
  const query = appRoles.length > 0 ? `?appRoles=${appRoles.join(',')}` : '';
  const res = await request(`/identities${query}`);
  return res ? res.content : [];
};
export const updateAppRole = (identityId, appRole) =>
  request(`/identities/${identityId}/app-role`, { method: 'PUT', body: JSON.stringify({ appRole }) });
export const fetchAllSnapshots = (query = '', page = 0, size = 20) =>
  request(`/identities/snapshots?query=${encodeURIComponent(query)}&page=${page}&size=${size}`);
export const createIdentity = (identity) =>
  request('/identities', { method: 'POST', body: JSON.stringify({
    firstName: identity.firstName,
    lastName: identity.lastName,
    email: identity.primaryEmail,
    phone: identity.phone || null,
    statusId: identity.statusId || null,
  }) });
export const deleteIdentity = (id) => request(`/identities/${id}`, { method: 'DELETE' });
export const fetchTimeline = (identityId) => request(`/identities/${identityId}/timeline`);
export const fetchIdentityGroups = (identityId) => request(`/identities/${identityId}/groups`);

// ─── Roles ─────────────────────────────────────────────────
export const fetchRoles = () => request('/roles');
export const createRole = (role) => request('/roles', { method: 'POST', body: JSON.stringify(role) });
export const deleteRole = (id) => request(`/roles/${id}`, { method: 'DELETE' });
export const assignRole = (identityId, roleId, startDate, endDate) =>
  request(`/identities/${identityId}/assignments/roles`, {
    method: 'POST', body: JSON.stringify({ roleId, startDate, endDate: endDate || null })
  });

// ─── Statuses ──────────────────────────────────────────────
export const fetchStatuses = () => request('/statuses');
export const createStatus = (status) => request('/statuses', { method: 'POST', body: JSON.stringify(status) });
export const deleteStatus = (id) => request(`/statuses/${id}`, { method: 'DELETE' });
export const assignStatus = (identityId, statusId) =>
  request(`/identities/${identityId}/status`, { method: 'PUT', body: JSON.stringify({ statusId }) });

// ─── Groups ────────────────────────────────────────────────
export const fetchGroups = () => request('/groups');
export const createGroup = (group) => request('/groups', { method: 'POST', body: JSON.stringify(group) });
export const updateGroup = (id, group) => request(`/groups/${id}`, { method: 'PUT', body: JSON.stringify(group) });
export const deleteGroup = (id) => request(`/groups/${id}`, { method: 'DELETE' });
export const fetchGroupMembers = (groupId) => request(`/groups/${groupId}/members`);
export const fetchGroupConfigurators = (groupId) => request(`/groups/${groupId}/configurators`);
export const addGroupConfigurator = (groupId, identityId) =>
  request(`/groups/${groupId}/configurators`, { method: 'POST', body: JSON.stringify({ identityId }) });
export const removeGroupConfigurator = (groupId, identityId) =>
  request(`/groups/${groupId}/configurators/${identityId}`, { method: 'DELETE' });

export const terminateAssignment = (type, id, endDate) => {
  const plurals = { role: 'roles' };
  if (!plurals[type]) return Promise.reject(new Error('Invalid assignment type for termination'));
  const q = endDate ? `?endDate=${endDate}` : '';
  return request(`/assignments/${plurals[type]}/${id}/terminate${q}`, { method: 'PATCH' });
};
