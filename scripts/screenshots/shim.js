/* Demo-Umgebung für Screenshots: ersetzt die Browser-API (chrome.*) und beantwortet
 * alle Anfragen an Node64 und ipv64.net mit erfundenen Testdaten aus demo-data.js.
 * Wird von make.py vor lib/api.js in popup.html bzw. options.html eingefügt. */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const LANG = params.get('lang') || 'en';
  const DEMO_NODE = 'http://raspberrypi.local:8080';

  function loadJson(path) {
    const x = new XMLHttpRequest();
    x.open('GET', path, false);
    x.send();
    return JSON.parse(x.responseText);
  }
  const messages = loadJson('_locales/' + LANG + '/messages.json');
  const manifest = loadJson('manifest.json');

  function getMessage(key, subs) {
    const m = messages[key];
    if (!m) return '';
    let s = m.message;
    for (const [name, ph] of Object.entries(m.placeholders || {})) {
      s = s.split('$' + name + '$').join(ph.content).split('$' + name.toUpperCase() + '$').join(ph.content);
    }
    const list = subs === undefined ? [] : Array.isArray(subs) ? subs : [subs];
    return s.replace(/\$(\d)/g, (_, n) => (list[n - 1] !== undefined ? String(list[n - 1]) : '')).replace(/\$\$/g, '$');
  }

  const config = { nodeUrl: DEMO_NODE, nodeKey: 'node64_demo', ipv64Key: params.has('cloud') ? 'demo' : '', interval: 2, notify: true, notifyUp: true, badge: true };
  const noop = () => {};
  const resolved = (v) => Promise.resolve(v);

  window.chrome = {
    i18n: { getMessage, getUILanguage: () => (LANG === 'de' ? 'de-DE' : 'en-US') },
    storage: { local: {
      get: (keys) => {
        if (params.has('empty')) return resolved({});
        const out = {};
        for (const k of [].concat(keys || Object.keys(config))) if (k in config) out[k] = config[k];
        return resolved(out);
      },
      set: () => resolved(),
    } },
    runtime: { getManifest: () => manifest, sendMessage: () => resolved(), openOptionsPage: noop, getURL: (p) => p },
    permissions: { contains: () => resolved(true), request: () => resolved(true) },
    tabs: {
      query: () => resolved([window.DEMO.activeTab]),
      create: () => resolved(), reload: () => resolved(),
    },
  };

  // Antworten nach Pfad (ohne /api bzw. /api/v2).
  window.fetch = async (input) => {
    const url = new URL(String(input));
    let body;
    if (url.origin === new URL(DEMO_NODE).origin) body = window.DEMO.node(url.pathname.replace(/^\/api/, ''), url.searchParams);
    else if (url.hostname === 'ipv64.net') body = { data: window.DEMO.cloud(url.pathname.replace(/^\/api\/v2/, '')) };
    if (body === undefined) return new Response('{"error":"not found"}', { status: 404 });
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  // Gewünschten Reiter öffnen: erst die Übersicht laden (setzt Name und Version der Node im Kopf), dann umschalten.
  try { localStorage.setItem('n64-tab', 'overview'); } catch { /* egal */ }
  const tab = params.get('tab');
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (tab && tab !== 'overview') {
        const b = document.querySelector('[data-tab="' + tab + '"]');
        if (b) b.click();
      }
      setTimeout(() => { document.documentElement.dataset.ready = '1'; }, 600);
    }, 500);
  });
})();
