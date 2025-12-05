const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const TOKEN_KEY = 'ai_editor_token';
const USER_KEY = 'ai_editor_user';

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

export async function register(name, email, password) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registration failed');
  saveAuth(data.token, data.user);
  return data.user;
}

export async function login(email, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  saveAuth(data.token, data.user);
  return data.user;
}

export function authHeader() {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}


export async function logout() {
  const refreshToken = getRefreshToken();
  
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify({ refreshToken }),
    });
  } catch (err) {
    console.error('Logout request failed:', err);
  }
  
  clearAuth();
}

// ========================================
// Token Refresh
// ========================================
let refreshPromise = null;

export async function refreshAccessToken() {
  // Prevent multiple simultaneous refresh requests
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshToken = getRefreshToken();
      
      if (!refreshToken) {
        throw new Error('No refresh token');
      }

      console.log('🔄 Refreshing access token...');

      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        clearAuth();
        throw new Error(data.error || 'Token refresh failed');
      }

      const user = getCurrentUser();
      saveAuth(data.accessToken, data.refreshToken, user);
      
      console.log('✅ Access token refreshed');
      return data.accessToken;
      
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}
// ========================================
// Auth Header
// ========================================
export function authHeader() {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

// ========================================
// Fetch with Auto-Refresh
// ========================================
export async function authFetch(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...authHeader(),
    ...(options.headers || {}),
  };

  let res = await fetch(url, { ...options, headers });

  // If token expired, try refresh once
  if (res.status === 401) {
    try {
      const data = await res.json();
      
      if (data.code === 'TOKEN_EXPIRED') {
        console.log('⚠️ Token expired, attempting refresh...');
        
        await refreshAccessToken();
        
        // Retry with new token
        headers.Authorization = `Bearer ${getToken()}`;
        res = await fetch(url, { ...options, headers });
      }
    } catch (err) {
      console.error('❌ Token refresh failed:', err);
      clearAuth();
      window.location.href = '/login';
      throw err;
    }
  }

  return res;
}
