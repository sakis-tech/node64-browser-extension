/* Node64 Browser Extension – Hintergrund: Polling, Badge, Benachrichtigungen, Kontextmenü. */
'use strict';
if (typeof importScripts === 'function' && !globalThis.N64) importScripts('lib/api.js');

const { N64 } = globalThis;
const ALARM = 'n64-poll';
const t = (k, ...s) => chrome.i18n.getMessage(k, s.map(String)) || k;

async function schedule() {
  const cfg = await N64.getConfig();
  const minutes = Math.max(1, Number(cfg.interval) || 2);
  await chrome.alarms.clear(ALARM);
  chrome.alarms.create(ALARM, { periodInMinutes: minutes, delayInMinutes: 0.05 });
}

async function setBadge(text, color) {
  await chrome.action.setBadgeText({ text });
  if (color) await chrome.action.setBadgeBackgroundColor({ color });
  if (chrome.action.setBadgeTextColor) await chrome.action.setBadgeTextColor({ color: '#ffffff' });
}

async function fetchChecks(cfg) {
  const node = N64.node(cfg);
  if (node) return (await node.get('/checks')) || [];
  const cloud = N64.ipv64(cfg);
  if (cloud) {
    const list = await cloud.get('/hc2/checks');
    return Array.isArray(list) ? list : (list && list.checks) || [];
  }
  return null;
}

async function poll() {
  const cfg = await N64.getConfig();
  let checks;
  try {
    checks = await fetchChecks(cfg);
  } catch (e) {
    await chrome.storage.local.set({ lastPoll: { at: Date.now(), error: e.message || 'error' } });
    if (cfg.badge) await setBadge('?', '#6b7280');
    return;
  }
  if (checks === null) { // nicht eingerichtet
    await setBadge('', null);
    return;
  }

  const now = {};
  for (const c of checks) if (c.token) now[c.token] = { s: N64.checkState(c), n: c.name || c.target || c.token };
  const { states: before = null } = await chrome.storage.local.get('states');
  const down = Object.values(now).filter((c) => c.s === 'down').length;
  const degraded = Object.values(now).filter((c) => c.s === 'degraded').length;

  await chrome.storage.local.set({ states: now, lastPoll: { at: Date.now(), down, degraded, total: checks.length } });

  if (cfg.badge) {
    if (down) await setBadge(String(down), '#dc2626');
    else if (degraded) await setBadge(String(degraded), '#d97706');
    else await setBadge('', null);
  } else {
    await setBadge('', null);
  }

  // Benachrichtigen nur bei echten Wechseln (nicht beim ersten Lauf).
  if (cfg.notify && before) {
    for (const [token, cur] of Object.entries(now)) {
      const prev = before[token];
      if (!prev || prev.s === cur.s) continue;
      if (cur.s === 'down') notify(token, t('notifyDownTitle'), cur.n);
      else if (cur.s === 'up' && prev.s === 'down' && cfg.notifyUp) notify(token, t('notifyUpTitle'), cur.n);
    }
  }
}

function notify(token, title, message) {
  chrome.notifications.create('n64:' + token + ':' + Date.now(), {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
    title,
    message,
  });
}

chrome.notifications.onClicked.addListener(async (id) => {
  if (!id.startsWith('n64:')) return;
  const cfg = await N64.getConfig();
  const token = id.split(':')[1];
  const url = cfg.nodeUrl ? `${cfg.nodeUrl}/healthchecks/${encodeURIComponent(token)}` : 'https://ipv64.net/';
  chrome.tabs.create({ url });
  chrome.notifications.clear(id);
});

/* Kontextmenü: Domain der Seite bzw. des Links in DNS64 freigeben/sperren */
function setupMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'n64-allow', title: t('menuAllow'), contexts: ['page', 'link'] });
    chrome.contextMenus.create({ id: 'n64-deny', title: t('menuDeny'), contexts: ['page', 'link'] });
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const domain = N64.domainOf(info.linkUrl || info.pageUrl || '');
  const cfg = await N64.getConfig();
  const node = N64.node(cfg);
  // Rückmeldung doppelt: Benachrichtigung und für ein paar Sekunden ein Zeichen am Symbol
  // (Benachrichtigungen sind im System oft stummgeschaltet).
  const say = async (msg, good) => {
    chrome.notifications.create({ type: 'basic', iconUrl: chrome.runtime.getURL('icons/icon-128.png'), title: 'Node64', message: msg });
    await setBadge(good ? '✓' : '!', good ? '#16a34a' : '#dc2626');
    setTimeout(poll, 4000); // stellt die normale Anzeige wieder her
  };
  if (!node) return say(t('notConfiguredText'), false);
  if (!domain) return say(t('noDomain'), false);
  const allow = info.menuItemId === 'n64-allow';
  try {
    await node.post(allow ? '/dns64/allowlist' : '/dns64/denylist', { domain });
    // Sonst liefert Node64 weiter die alte Antwort aus dem Cache.
    await node.post('/dns64/cache/flush').catch(() => {});
    // Betrifft die Regel die Seite selbst (nicht einen Link darauf), ohne Browser-Cache neu laden.
    if (!info.linkUrl && tab && tab.id !== undefined) await chrome.tabs.reload(tab.id, { bypassCache: true }).catch(() => {});
    say(t(allow ? 'toastAllowed' : 'toastDenied', domain), true);
  } catch (e) {
    say(t('errorGeneric', e.message), false);
  }
});

chrome.runtime.onInstalled.addListener((d) => {
  schedule();
  if (d.reason === 'install') chrome.runtime.openOptionsPage();
});
chrome.runtime.onStartup.addListener(schedule);
setupMenus(); // bei jedem Start des Hintergrundskripts, damit die Einträge nie fehlen
chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) poll(); });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (['nodeUrl', 'nodeKey', 'ipv64Key'].some((k) => k in changes)) chrome.storage.local.remove('states');
  if (['nodeUrl', 'nodeKey', 'ipv64Key', 'interval', 'badge'].some((k) => k in changes)) schedule();
});
chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg && msg.type === 'poll') {
    poll().then(() => respond({ ok: true }), () => respond({ ok: false }));
    return true;
  }
  return false;
});
