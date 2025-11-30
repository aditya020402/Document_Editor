const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const TOKEN_KEY = 'ai_admin_token';
const USER_KEY = 'ai_admin_user';

export function saveAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getCurrentUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function login(email, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  if (data.user.role !== 'admin') {
    throw new Error('Not an admin account');
  }
  saveAuth(data.token, data.user);
  return data.user;
}

export function authHeader() {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
