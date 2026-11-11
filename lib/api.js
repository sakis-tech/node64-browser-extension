/* Node64 Browser Extension – gemeinsame API-Schicht (Popup, Optionen, Hintergrund).
 * Bewusst ohne ES-Module, damit dieselbe Datei im Chrome-Service-Worker
 * (importScripts) und in der Firefox-Hintergrundseite (scripts) läuft. */
(function (g) {
  'use strict';

  const TIMEOUT_MS = 8000;
  const IPV64_BASE = 'https://ipv64.net/api/v2';
  const DEFAULTS = { nodeUrl: '', nodeKey: '', ipv64Key: '', interval: 2, notify: true, notifyUp: true, badge: true };

  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.name = 'ApiError';
      this.status = status; // 0 = Netzwerk/Timeout
    }
  }

  /** "pi:8080/" -> "http://pi:8080"; leer bleibt leer; ungültig -> null */
  function normalizeUrl(input) {
    let s = String(input || '').trim();
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
    try {
      const u = new URL(s);
      if (!u.hostname) return null;
      let path = u.pathname.replace(/\/+$/, '').replace(/\/api$/, '');
      return u.origin + path;
    } catch {
      return null;
    }
  }

  /** Match-Pattern für permissions.request (ohne Port – Firefox kennt keine Ports in Patterns). */
  function originPattern(url) {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}/*`;
  }

  async function getConfig() {
    const stored = await chrome.storage.local.get(Object.keys(DEFAULTS));
    return { ...DEFAULTS, ...stored };
  }

  async function request(base, key, path, opts = {}) {
    const url = new URL(base + path);
    for (const [k, v] of Object.entries(opts.query || {})) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    }
    const headers = { Accept: 'application/json' };
    if (key) headers.Authorization = 'Bearer ' + key;
    let body;
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), opts.timeout || TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url, {
        method: opts.method || 'GET',
        headers,
        body,
        signal: ctl.signal,
        credentials: 'omit', // nie die Browser-Sitzung des Web-UI mitschicken
        cache: 'no-store',
      });
    } catch (e) {
      throw new ApiError(e && e.name === 'AbortError' ? 'timeout' : 'network', 0);
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = null; }
    }
    if (!res.ok) {
      const msg = (data && (data.error || data.detail || data.message)) || res.statusText || 'HTTP ' + res.status;
      throw new ApiError(String(msg), res.status);
    }
    return data;
  }

  /** Client für die lokale Node64-API (http://<host>:8080/api). */
  function node(cfg) {
    if (!cfg.nodeUrl || !cfg.nodeKey) return null;
    const base = cfg.nodeUrl + '/api';
    const call = (path, opts) => request(base, cfg.nodeKey, path, opts);
    return {
      url: cfg.nodeUrl,
      get: (path, query) => call(path, { query }),
      post: (path, body) => call(path, { method: 'POST', body: body === undefined ? {} : body }),
      del: (path, query) => call(path, { method: 'DELETE', query }),
    };
  }

  /** Client für die ipv64.net-API v2 (Antworten stecken in { data: … }). */
  function ipv64(cfg) {
    if (!cfg.ipv64Key) return null;
    return {
      get: async (path, query) => {
        const r = await request(IPV64_BASE, cfg.ipv64Key, path, { query });
        return r && typeof r === 'object' && 'data' in r ? r.data : r;
      },
    };
  }

  /** Einheitlicher Zustand eines Checks: down | degraded | pending | up | paused */
  function checkState(c) {
    if (c.paused) return 'paused';
    const s = c.state && typeof c.state === 'object' ? c.state.state : c.state || c.status;
    return ['up', 'down', 'degraded', 'pending', 'paused'].includes(s) ? s : 'pending';
  }

  /** Hostname -> gültiger DNS-Name oder '' (keine IPs, kein localhost). */
  function domainOf(url) {
    try {
      const u = new URL(url);
      if (!/^https?:$/.test(u.protocol)) return '';
      const h = u.hostname.replace(/\.$/, '').toLowerCase();
      if (!h.includes('.') || /^[\d.]+$/.test(h) || h.includes(':')) return '';
      return h;
    } catch {
      return '';
    }
  }

  g.N64 = { DEFAULTS, ApiError, normalizeUrl, originPattern, getConfig, node, ipv64, checkState, domainOf };
})(globalThis);
