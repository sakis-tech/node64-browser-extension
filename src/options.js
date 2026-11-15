/* Node64 Browser Extension – Einstellungen */
'use strict';
const { N64 } = globalThis;
const t = (k, ...s) => chrome.i18n.getMessage(k, s.map(String)) || k;
const $ = (id) => document.getElementById(id);

function show(el, msg, good) {
  el.textContent = msg;
  el.className = 'result ' + (good === undefined ? '' : good ? 'ok' : 'bad');
}

function errText(e) {
  if (e && e.status === 0) return t(e.message === 'timeout' ? 'errorTimeout' : 'errorNetwork');
  if (e && e.status === 401) return t('errorAuth');
  return t('errorGeneric', (e && e.message) || '?');
}

/** Eingaben lesen; bei ungültiger Adresse null. Läuft synchron (wichtig für permissions.request). */
function read() {
  const nodeUrl = N64.normalizeUrl($('nodeUrl').value);
  if (nodeUrl === null) return null;
  return {
    nodeUrl,
    nodeKey: $('nodeKey').value.trim(),
    ipv64Key: $('ipv64Key').value.trim(),
    interval: Math.min(60, Math.max(1, Math.round(Number($('interval').value) || 2))),
    badge: $('badge').checked,
    notify: $('notify').checked,
    notifyUp: $('notifyUp').checked,
  };
}

/** Host-Zugriff anfragen – muss direkt im Klick (ohne await davor) aufgerufen werden. */
function requestAccess(cfg, which) {
  const origins = [];
  if (which !== 'cloud' && cfg.nodeUrl) origins.push(N64.originPattern(cfg.nodeUrl));
  if (which !== 'node' && cfg.ipv64Key) origins.push('https://ipv64.net/*');
  if (!origins.length) return Promise.resolve(true);
  return chrome.permissions.request({ origins }).catch(() => false);
}

async function testNode() {
  const cfg = read();
  const out = $('nodeResult');
  if (!cfg || !cfg.nodeUrl || !cfg.nodeKey) return show(out, t('optNeedUrlKey'), false);
  const granted = requestAccess(cfg, 'node');
  show(out, t('testing'));
  if (!(await granted)) return show(out, t('optNoPermission'), false);
  try {
    const node = N64.node(cfg);
    const [v, me] = await Promise.all([node.get('/version'), node.get('/users/me')]);
    // Antwort 200 ohne JSON (z. B. die Seite eines anderen Dienstes) ist keine Node64-API.
    if (!v || typeof v !== 'object' || !v.version) return show(out, t('optNotNode'), false);
    // Erfolgreich getestet = gespeichert, sonst bleibt das Popup trotz grünem Test leer.
    await chrome.storage.local.set({ nodeUrl: cfg.nodeUrl, nodeKey: cfg.nodeKey });
    $('nodeUrl').value = cfg.nodeUrl;
    chrome.runtime.sendMessage({ type: 'poll' }).catch(() => {});
    show(out, t('optNodeOk', v.hostname || cfg.nodeUrl, v.version, (me && me.username) || '?') + ' ' + t('saved'), true);
  } catch (e) {
    show(out, errText(e), false);
  }
}

async function testCloud() {
  const cfg = read();
  const out = $('cloudResult');
  if (!cfg || !cfg.ipv64Key) return show(out, t('optNeedKey'), false);
  const granted = requestAccess(cfg, 'cloud');
  show(out, t('testing'));
  if (!(await granted)) return show(out, t('optNoPermission'), false);
  try {
    const me = await N64.ipv64(cfg).get('/me');
    await chrome.storage.local.set({ ipv64Key: cfg.ipv64Key });
    chrome.runtime.sendMessage({ type: 'poll' }).catch(() => {});
    show(out, t('optCloudOk', (me && (me.username || me.email)) || '?', (me && me.plan && me.plan.name) || '?') + ' ' + t('saved'), true);
  } catch (e) {
    show(out, errText(e), false);
  }
}

async function save() {
  const cfg = read();
  const out = $('saveResult');
  if (!cfg) return show(out, t('optBadUrl'), false);
  if (cfg.nodeUrl && !cfg.nodeKey) return show(out, t('optNeedUrlKey'), false);
  const granted = requestAccess(cfg);
  if (!(await granted)) return show(out, t('optNoPermission'), false);
  await chrome.storage.local.set(cfg);
  $('nodeUrl').value = cfg.nodeUrl;
  $('interval').value = cfg.interval;
  chrome.runtime.sendMessage({ type: 'poll' }).catch(() => {});
  show(out, t('saved'), true);
}

async function init() {
  $('extVersion').textContent = t('extVersion', chrome.runtime.getManifest().version);
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  const cfg = await N64.getConfig();
  for (const k of ['nodeUrl', 'nodeKey', 'ipv64Key', 'interval']) $(k).value = cfg[k];
  for (const k of ['badge', 'notify', 'notifyUp']) $(k).checked = !!cfg[k];
  for (const b of document.querySelectorAll('[data-toggle]')) {
    b.addEventListener('click', () => {
      const input = $(b.dataset.toggle);
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      b.textContent = t(reveal ? 'hide' : 'show');
    });
  }
  $('testNode').addEventListener('click', testNode);
  $('testCloud').addEventListener('click', testCloud);
  $('save').addEventListener('click', save);
}
init();
