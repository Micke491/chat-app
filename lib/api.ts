import { getAuthToken, removeAuthToken } from './storage';
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const trustedDeviceToken = require('./storage').getTrustedDeviceToken?.();
  if (trustedDeviceToken && !headers.has('X-Trusted-Device-Token')) {
    headers.set('X-Trusted-Device-Token', trustedDeviceToken);
  }

  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers,
  });

  // A 401 from an /auth/ endpoint means the submitted credentials were wrong
  // (bad password, bad 2FA code) — that is an answer for the form to render,
  // not a dead session. Reloading the page there would wipe the error message
  // the caller is about to set. Only a 401 on a normally authenticated request
  // means our token stopped working.
  const isAuthEndpoint = /(^|\/)api\/auth\//.test(url);
  if (response.status === 401 && typeof window !== 'undefined' && !isAuthEndpoint && token) {
    removeAuthToken();
    // Already on the login page (e.g. the stale-token session check): drop the
    // token and let the page render. Navigating here would only reload it.
    if (!window.location.pathname.startsWith('/auth-pages/')) {
      window.location.href = '/auth-pages/login';
    }
  }

  return response;
}
