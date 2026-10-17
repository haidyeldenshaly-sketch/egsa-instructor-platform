const BASE = (import.meta.env.VITE_API_BASE || '') + '/api/v1';
const REFRESH_KEY = 'egsa_refresh';
let accessToken = null;
let refreshing = null;

export class ApiClientError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}
export const tokens = {
  set(access, refresh) { accessToken = access; try { if (refresh) localStorage.setItem(REFRESH_KEY, refresh); } catch { /* ignore */ } },
  clear() { accessToken = null; try { localStorage.removeItem(REFRESH_KEY); } catch { /* ignore */ } },
  getRefresh() { try { return localStorage.getItem(REFRESH_KEY); } catch { return null; } },
  hasAccess: () => !!accessToken,
};
const qs = (q) => { const p = new URLSearchParams(); Object.entries(q || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, v); }); const s = p.toString(); return s ? `?${s}` : ''; };

const createSignal = (timeoutMs = 15000, userSignal) => {
  if (userSignal) return userSignal;
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
};

async function raw(path, { method = 'GET', body, query, auth = true, signal, timeout = 15000 } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}${qs(query)}`, {
      method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: createSignal(timeout, signal),
    });
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    throw new ApiClientError(0, err?.name === 'TimeoutError' ? 'timeout' : 'network');
  }
  let json = null; try { json = await res.json(); } catch { /* no body */ }
  if (!res.ok) throw new ApiClientError(res.status, json?.error?.message || 'error', json?.error?.details);
  return json;
}
export async function refreshSession() {
  const rt = tokens.getRefresh();
  if (!rt) throw new ApiClientError(401, 'no refresh token');
  refreshing ||= raw('/auth/refresh', { method: 'POST', body: { refreshToken: rt }, auth: false })
    .then((r) => { tokens.set(r.data.accessToken, r.data.refreshToken); return r.data; })
    .catch((e) => { tokens.clear(); throw e; })
    .finally(() => { refreshing = null; });
  return refreshing;
}
export async function request(path, opts = {}) {
  try { return await raw(path, opts); }
  catch (e) {
    if (e.status === 401 && opts.auth !== false && tokens.getRefresh()) {
      try { await refreshSession(); return await raw(path, opts); }
      catch (e2) { if (e2.status === 401) window.dispatchEvent(new Event('egsa:unauthorized')); throw e2; }
    }
    if (e.status === 401 && opts.auth !== false) window.dispatchEvent(new Event('egsa:unauthorized'));
    throw e;
  }
}
export const get = (p, query) => request(p, { query }).then((r) => r.data);
export const getWithMeta = (p, query) => request(p, { query });
export const post = (p, body) => request(p, { method: 'POST', body }).then((r) => r.data);
export const put = (p, body) => request(p, { method: 'PUT', body }).then((r) => r.data);
export const patch = (p, body) => request(p, { method: 'PATCH', body }).then((r) => r.data);
export const del = (p) => request(p, { method: 'DELETE' }).then((r) => r.data);
export const publicPost = (p, body) => request(p, { method: 'POST', body, auth: false }).then((r) => r.data);
export async function upload(path, formData, { signal, timeout = 60000 } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: formData,
      signal: createSignal(timeout, signal),
    });
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    throw new ApiClientError(0, err?.name === 'TimeoutError' ? 'timeout' : 'network');
  }
  let json = null; try { json = await res.json(); } catch { /* no body */ }
  if (!res.ok) throw new ApiClientError(res.status, json?.error?.message || 'error', json?.error?.details);
  return json?.data;
}
