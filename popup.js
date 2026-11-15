/* Node64 Browser Extension – Popup */
'use strict';
const { N64 } = globalThis;

const t = (k, ...s) => chrome.i18n.getMessage(k, s.map(String)) || k;
const LANG = chrome.i18n.getUILanguage();
const nf = new Intl.NumberFormat(LANG);
const rtf = new Intl.RelativeTimeFormat(LANG, { numeric: 'auto', style: 'short' });
const view = document.getElementById('view');

const MODULE_LABEL = {
  healthchecks: 'Healthchecks', dns64: 'DNS64', dyndns: 'DynDNS64', cdn64: 'PROXY64 / CDN64',
  honeypot: 'Honeypot64', monitor64: 'Monitor64', sonar64: 'Sonar64',
};

let cfg, node, cloud;
let currentTab = 'overview';
let renderSeq = 0;
let busy = 0;       // laufende Aktionen, die das automatische Neuladen aussetzen
let ticker = null;  // Countdown der DNS-Pause

/* ---------- kleine Helfer ---------- */

/** DOM-Baukasten. Inhalte landen immer als Textknoten im DOM (kein innerHTML mit API-Daten). */
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === undefined || c === null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

function ago(value) {
  if (!value) return '';
  const ms = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const s = Math.round((ms - Date.now()) / 1000);
  const a = Math.abs(s);
  if (a < 60) return rtf.format(s, 'second');
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  return rtf.format(Math.round(s / 86400), 'day');
}

function uptime(seconds) {
  const d = Math.floor(seconds / 86400), hr = Math.floor((seconds % 86400) / 3600), m = Math.floor((seconds % 3600) / 60);
  return d ? `${d}d ${hr}h` : hr ? `${hr}h ${m}m` : `${m}m`;
}

let toastTimer;
function toast(msg, isError) {
  const el = document.getElementById('toast');
  el.textContent = (isError ? '⚠ ' : '✓ ') + msg;
  el.className = isError ? 'error' : 'ok';
  el.hidden = false;
  // Animation neu starten, auch wenn schon ein Toast sichtbar ist
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, isError ? 5000 : 2800);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Nach dem nächsten Neuzeichnen das Element mit data-key kurz aufleuchten lassen. */
let pendingFlash = null;
function flash(key, kind) { pendingFlash = { key, kind: kind || 'ok' }; }
function applyFlash() {
  if (!pendingFlash) return;
  const { key, kind } = pendingFlash;
  pendingFlash = null;
  for (const el of view.querySelectorAll('[data-key]')) {
    if (el.dataset.key === key) { el.classList.add('flash-' + kind); el.scrollIntoView({ block: 'nearest' }); }
  }
}

function errText(e) {
  if (e && e.status === 0) return t(e.message === 'timeout' ? 'errorTimeout' : 'errorNetwork');
  if (e && e.status === 401) return t('errorAuth');
  if (e && e.status === 403) return t('errorForbidden');
  return t('errorGeneric', (e && e.message) || '?');
}

/** Aktion ausführen: Knopf zeigt solange einen Spinner, danach kurz einen Haken; Ergebnis als Toast. */
async function act(btn, fn, okMsg) {
  if (btn) { btn.disabled = true; btn.classList.add('busy'); }
  try {
    await fn();
    if (okMsg) toast(okMsg);
    if (btn && btn.isConnected) { btn.classList.add('done'); setTimeout(() => btn.classList.remove('done'), 1400); }
    return true;
  } catch (e) {
    toast(errText(e), true);
    if (btn && btn.isConnected) { btn.classList.add('failed'); setTimeout(() => btn.classList.remove('failed'), 1400); }
    return false;
  } finally {
    if (btn) { btn.disabled = false; btn.classList.remove('busy'); }
  }
}

const settle = (list) => Promise.allSettled(list);
const ok = (r) => (r.status === 'fulfilled' ? r.value : null);
const openTab = (url) => chrome.tabs.create({ url });
const uiLink = (path) => node.url + path;

function card(title, ...children) {
  return h('section', { class: 'card' }, title ? h('h2', {}, title) : null, children);
}
function errorCard(title, e) {
  return card(title, h('div', { class: 'err' }, errText(e)));
}
function moduleOff(r) { // 404/503 = Modul aus bzw. nicht vorhanden
  return r.status === 'rejected' && r.reason && [404, 503].includes(r.reason.status);
}

/* ---------- Übersicht ---------- */

async function renderOverview(seq) {
  const out = [];
  if (node) {
    const [st, ch, ce, dn, dy] = await settle([
      node.get('/status'), node.get('/checks'), node.get('/certs'),
      node.get('/dns64/summary', { range: '24h' }), node.get('/dyndns/status'),
    ]);
    if (seq !== renderSeq) return null;
    if (st.status === 'rejected') {
      out.push(errorCard(t('tabOverview'), st.reason));
    } else {
      const s = st.value || {};
      setHeader(s.node);
      const checks = ok(ch) || [];
      const down = checks.filter((c) => N64.checkState(c) === 'down').length;
      const up = checks.filter((c) => N64.checkState(c) === 'up').length;
      const sum = ok(dn) && ok(dn).summary;
      const pct = sum && sum.total ? Math.round((sum.blocked / sum.total) * 1000) / 10 : null;
      const ip = ok(dy) && ok(dy).ipv4 && ok(dy).ipv4.ip;

      out.push(h('div', { class: 'tiles' },
        h('button', { class: 'tile ' + (down ? 'bad' : checks.length ? 'good' : ''), onclick: () => switchTab('checks') },
          h('div', { class: 'num' }, ch.status === 'fulfilled' ? (down ? nf.format(down) : nf.format(up)) : '–'),
          h('div', { class: 'lbl' }, ch.status === 'fulfilled' ? (down ? t('tileDown') : t('tileUp', checks.length)) : 'Healthchecks')),
        h('button', { class: 'tile', onclick: () => switchTab('dns') },
          h('div', { class: 'num' }, pct === null ? '–' : nf.format(pct) + ' %'),
          h('div', { class: 'lbl' }, t('tileBlocked'))),
        h('button', { class: 'tile', onclick: () => switchTab('dyndns') },
          h('div', { class: 'num', style: 'font-size:14px;line-height:1.65' }, ip || '–'),
          h('div', { class: 'lbl' }, t('tileIp')))));

      const mods = (s.modules || []).filter((m) => m.available !== false);
      const boards = Object.fromEntries((s.boards || s.summary || []).map((b) => [b.module, b]));
      if (mods.length) {
        out.push(card(t('modules'), h('ul', { class: 'rows' }, mods.map((m) => {
          const state = m.last_error ? 'down' : m.running ? 'up' : m.enabled ? 'warn' : 'paused';
          const b = boards[m.name];
          const info = m.last_error || (!m.enabled ? t('moduleOff') : b ? t('boardLine', b.ok, b.down) : m.running ? t('moduleRunning') : t('moduleStopped'));
          return h('li', {},
            h('span', { class: 'dot ' + state }),
            h('a', { class: 'rowlink main', href: uiLink(m.path || '/'), target: '_blank', rel: 'noreferrer' },
              h('span', { class: 'name' }, MODULE_LABEL[m.name] || m.name)),
            h('span', { class: 'val' + (m.last_error || (b && b.down) ? ' err' : '') }, info));
        }))));
      }

      const certs = (ok(ce) || []).filter((c) => c.status === 'error' || c.status === 'expired' || daysLeft(c.not_after) < 21);
      if (certs.length) {
        out.push(card(t('certsExpiring'), h('ul', { class: 'rows' }, certs.slice(0, 5).map((c) => {
          const d = daysLeft(c.not_after);
          return h('li', {},
            h('span', { class: 'dot ' + (c.status !== 'valid' || d < 7 ? 'down' : 'warn') }),
            h('span', { class: 'main' }, h('span', { class: 'name' }, (c.names || []).join(', ') || '#' + c.id)),
            h('span', { class: 'val' }, c.status !== 'valid' ? c.status : t('daysLeft', d)));
        }))));
      }

      const l = s.link;
      if (l && l.linked) {
        out.push(card('ipv64.net', h('div', { class: 'kv' },
          h('span', { class: 'k' }, t('linkState')),
          h('span', { class: 'v' }, l.connected ? t('linkConnected') : t('linkDisconnected')),
          h('span', { class: 'pill ' + (l.connected ? 'up' : 'warn') }, l.plan || '–'))));
      }
    }
  }
  if (cloud) {
    const [me] = await settle([cloud.get('/me')]);
    if (seq !== renderSeq) return null;
    if (me.status === 'rejected') out.push(errorCard(t('account'), me.reason));
    else out.push(accountCard(me.value || {}));
  }
  return out;
}

function daysLeft(iso) {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? Math.floor((ms - Date.now()) / 86400000) : Infinity;
}

function accountCard(me) {
  const usage = Object.entries(me.usage || {}).filter(([, u]) => u && typeof u.used === 'number');
  return card(t('account'),
    h('div', { class: 'kv' },
      h('span', { class: 'k' }, t('accountUser')),
      h('span', { class: 'v' }, me.username || me.email || '–'),
      h('span', { class: 'pill' }, (me.plan && me.plan.name) || '–')),
    usage.slice(0, 6).map(([key, u]) => {
      const pct = u.limit ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0;
      return h('div', { style: 'margin-top:7px' },
        h('div', { class: 'small', style: 'display:flex;justify-content:space-between;gap:8px' },
          h('span', { class: 'muted' }, key.replace(/_/g, ' ')),
          h('span', {}, nf.format(u.used) + ' / ' + (u.limit ? nf.format(u.limit) : '∞'))),
        u.limit ? h('div', { class: 'bar' + (pct >= 85 ? ' hot' : '') }, h('i', { style: `width:${pct}%` })) : null);
    }));
}

/* ---------- Healthchecks ---------- */

const ORDER = { down: 0, degraded: 1, pending: 2, up: 3, paused: 4 };
let checkFilter = '';

async function renderChecks(seq) {
  let checks, fromCloud = false;
  try {
    if (node) checks = (await node.get('/checks')) || [];
    else {
      const r = await cloud.get('/hc2/checks');
      checks = Array.isArray(r) ? r : (r && r.checks) || [];
      fromCloud = true;
    }
  } catch (e) {
    return [errorCard('Healthchecks', e)];
  }
  if (seq !== renderSeq) return null;
  checks.sort((a, b) => ORDER[N64.checkState(a)] - ORDER[N64.checkState(b)] || String(a.name).localeCompare(String(b.name)));

  const list = h('ul', { class: 'rows' });
  const draw = (q) => {
    checkFilter = q;
    const needle = q.trim().toLowerCase();
    const rows = checks.filter((c) => !needle || [c.name, c.target, c.type, c.group, ...(c.tags || [])].some((x) => String(x || '').toLowerCase().includes(needle)));
    list.replaceChildren(...(rows.length ? rows.map((c) => checkRow(c, fromCloud)) : [h('li', { class: 'empty' }, t('noChecks'))]));
  };
  draw(checkFilter);

  const counts = checks.reduce((m, c) => { const s = N64.checkState(c); m[s] = (m[s] || 0) + 1; return m; }, {});
  const head = h('h2', {},
    h('span', { class: 'grow' }, 'Healthchecks'),
    counts.down ? h('span', { class: 'pill down' }, t('countDown', counts.down)) : null,
    counts.degraded ? h('span', { class: 'pill warn' }, t('countDegraded', counts.degraded)) : null,
    h('span', { class: 'pill up' }, t('countUp', counts.up || 0)));
  const out = [];
  if (checks.length > 6) out.push(h('input', { class: 'search', type: 'search', value: checkFilter, placeholder: t('search'), 'aria-label': t('search'), oninput: (e) => draw(e.target.value) }));
  out.push(h('section', { class: 'card' }, head, list));
  return out;
}

function checkRow(c, fromCloud) {
  const state = N64.checkState(c);
  const st = (c.state && typeof c.state === 'object' && c.state) || {};
  const checked = state !== 'paused' && ago(st.last_check_at);
  const sub = [String(c.type || '').toUpperCase(), c.target, checked ? t('checkedAt', checked) : ''].filter(Boolean).join(' · ');
  const reason = state === 'down' || state === 'degraded' ? st.last_message || st.last_reason : '';
  const val = state === 'paused' ? t('statePaused')
    : state === 'down' ? ago(st.down_since || st.since)
    : Number.isFinite(st.last_latency_ms) && st.last_latency_ms > 0 ? nf.format(Math.round(st.last_latency_ms)) + ' ms' : '';
  const main = h('span', { class: 'name' }, c.name || c.target || c.token);
  const subEl = h('span', { class: 'sub' + (reason ? ' err' : '') }, reason || sub);
  const li = h('li', { title: reason || sub, 'data-key': c.token },
    h('span', { class: 'dot ' + state }),
    fromCloud
      ? h('span', { class: 'main' }, main, subEl)
      : h('a', { class: 'rowlink main', href: uiLink('/healthchecks/' + encodeURIComponent(c.token)), target: '_blank', rel: 'noreferrer' }, main, subEl),
    h('span', { class: 'val' }, val));
  if (!fromCloud) {
    if (c.type !== 'push' && !c.paused) {
      li.append(h('button', { class: 'btn mini', title: t('runNow'), onclick: (e) => runCheck(e.currentTarget, c, li, subEl) }, t('runShort')));
    }
    li.append(h('button', { class: 'btn mini', onclick: (e) => act(e.currentTarget, async () => {
      await node.post(`/checks/${encodeURIComponent(c.token)}/${c.paused ? 'resume' : 'pause'}`);
      flash(c.token, c.paused ? 'ok' : 'warn');
      await refresh();
    }, t(c.paused ? 'toastCheckResumed' : 'toastCheckPaused', c.name || '')) }, c.paused ? t('resume') : t('pause')));
  }
  return li;
}

/** „Prüfen": anstoßen, auf das neue Messergebnis warten und es deutlich anzeigen. */
async function runCheck(btn, c, li, subEl) {
  const path = '/checks/' + encodeURIComponent(c.token);
  const before = c.state && c.state.last_check_at;
  const name = c.name || c.target || '';
  btn.disabled = true;
  btn.classList.add('busy');
  li.classList.add('running');
  subEl.className = 'sub';
  subEl.textContent = t('checkRunning');
  busy++; // automatisches Neuladen solange aussetzen
  try {
    await node.post(path + '/run');
    let fresh = null;
    for (let i = 0; i < 15 && !fresh; i++) {
      await sleep(700);
      const x = await node.get(path).catch(() => null);
      if (x && x.state && x.state.last_check_at && x.state.last_check_at !== before) fresh = x;
    }
    if (!fresh) {
      toast(t('toastRunPending', name));
    } else {
      const s = N64.checkState(fresh);
      const ms = Number.isFinite(fresh.state.last_latency_ms) ? nf.format(Math.round(fresh.state.last_latency_ms)) + ' ms' : '';
      if (s === 'up') toast(t('toastRunUp', name, ms));
      else toast(t('toastRunBad', name, fresh.state.last_message || fresh.state.last_reason || s), true);
      flash(c.token, s === 'up' ? 'ok' : 'bad');
    }
  } catch (e) {
    toast(errText(e), true);
  } finally {
    busy--;
  }
  await refresh();
}

/* ---------- DNS64 ---------- */

async function activeDomain() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return N64.domainOf((tab && tab.url) || '');
  } catch {
    return '';
  }
}

async function renderDns(seq) {
  if (!node) return [card('DNS64', h('div', { class: 'empty' }, t('needsNode')))];
  const domain = await activeDomain();
  const [st, sm, bl, site, al, dl] = await settle([
    node.get('/dns64/status'), node.get('/dns64/summary', { range: '24h' }),
    node.get('/dns64/log', { status: 'blocked', limit: 60 }),
    domain ? node.get('/dns64/log', { q: domain, limit: 100 }) : Promise.resolve(null),
    domain ? node.get('/dns64/allowlist') : Promise.resolve(null),
    domain ? node.get('/dns64/denylist') : Promise.resolve(null),
  ]);
  if (seq !== renderSeq) return null;
  if (moduleOff(st)) return [card('DNS64', h('div', { class: 'empty' }, t('moduleOff')))];
  if (st.status === 'rejected') return [errorCard('DNS64', st.reason)];

  const out = [];
  const b = (st.value && st.value.blocking) || {};
  const s = (ok(sm) && ok(sm).summary) || null;
  const pauseBtn = (min, label) => h('button', { class: 'btn', onclick: (e) => act(e.currentTarget, async () => {
    await node.post('/dns64/pause', { minutes: min });
    flash('dns-status', 'warn');
    await refresh();
  }, t('toastPaused')) }, label);

  const timed = b.paused && !b.until_resumed && b.paused_until;
  const countdown = timed ? h('span', { class: 'sub' }) : null;
  if (timed) {
    const end = Date.parse(b.paused_until);
    const tick = () => {
      const left = Math.max(0, Math.round((end - Date.now()) / 1000));
      countdown.textContent = t('dnsRemaining', Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'));
      if (left <= 0) { clearInterval(ticker); refresh(); }
    };
    clearInterval(ticker);
    ticker = setInterval(tick, 1000);
    tick();
  }
  const statusCard = card(t('dnsFilter'),
    h('div', { style: 'display:flex;align-items:center;gap:10px' },
      h('span', { class: 'bigdot ' + (b.paused ? 'warn' : 'up') }, b.paused ? '‖' : '✓'),
      h('span', { style: 'flex:1;min-width:0' },
        h('strong', { style: 'display:block' }, b.paused
          ? (timed ? t('dnsPausedUntil', new Date(b.paused_until).toLocaleTimeString(LANG, { hour: '2-digit', minute: '2-digit' })) : t('dnsPausedOpen'))
          : t('dnsActive')),
        countdown),
      b.paused ? h('button', { class: 'btn primary', onclick: (e) => act(e.currentTarget, async () => { await node.post('/dns64/resume'); flash('dns-status', 'ok'); await refresh(); }, t('toastResumed')) }, t('dnsResume')) : null),
    b.paused ? null : h('div', { class: 'btnrow' },
      h('span', { class: 'muted', style: 'align-self:center' }, t('dnsPauseFor')),
      pauseBtn(5, '5 min'), pauseBtn(30, '30 min'), pauseBtn(60, '1 h'), pauseBtn(0, t('dnsPauseOpen'))));
  statusCard.dataset.key = 'dns-status';
  statusCard.classList.add(b.paused ? 'tint-warn' : 'tint-ok');
  out.push(statusCard);

  if (s) {
    const pct = s.total ? Math.round((s.blocked / s.total) * 1000) / 10 : 0;
    out.push(h('div', { class: 'tiles' },
      h('div', { class: 'tile' }, h('div', { class: 'num' }, nf.format(s.total)), h('div', { class: 'lbl' }, t('dnsQueries'))),
      h('div', { class: 'tile' }, h('div', { class: 'num' }, nf.format(pct) + ' %'), h('div', { class: 'lbl' }, t('dnsBlockedN', nf.format(s.blocked)))),
      h('div', { class: 'tile' }, h('div', { class: 'num' }, nf.format(s.clients)), h('div', { class: 'lbl' }, t('dnsClients')))));
  }

  if (domain) {
    const rows = ((ok(site) && ok(site).rows) || []).filter((r) => r.domain === domain || String(r.domain).endsWith('.' + domain));
    const blocked = rows.filter((r) => r.status === 'blocked').length;
    // Eigene Regel: Einträge gelten samt Subdomains, daher auch übergeordnete Domains prüfen.
    const covers = (list) => ((ok(list) || []).map((x) => x && x.domain).filter(Boolean).find((d) => domain === d || domain.endsWith('.' + d))) || '';
    const allowedBy = covers(al), deniedBy = covers(dl);
    const rule = deniedBy ? 'deny' : allowedBy ? 'allow' : '';
    const change = (method, list, dom, kind, msg) => (e) => act(e.currentTarget, async () => {
      if (method === 'add') await node.post('/dns64/' + list, { domain: dom });
      else await node.del('/dns64/' + list, { domain: dom });
      flash('site', kind);
      await refresh();
    }, t(msg, dom));
    const siteCard = card(t('thisSite'),
      h('div', { style: 'display:flex;align-items:center;gap:8px' },
        h('span', { class: 'main', style: 'flex:1;min-width:0' },
          h('span', { class: 'name mono', style: 'display:block;overflow:hidden;text-overflow:ellipsis' }, domain),
          h('span', { class: 'sub muted small' }, site.status === 'rejected' ? errText(site.reason) : rows.length ? t('siteStats', rows.length, blocked) : t('siteNoQueries'))),
        h('span', { class: 'pill big ' + (rule === 'deny' ? 'down' : rule === 'allow' ? 'up' : ''), title: deniedBy || allowedBy },
          rule === 'deny' ? t('ruleDenied') : rule === 'allow' ? t('ruleAllowed') : t('ruleNone'))),
      h('div', { class: 'btnrow' },
        rule === 'allow'
          ? h('button', { class: 'btn', onclick: change('del', 'allowlist', allowedBy, 'warn', 'toastUnallowed') }, t('unallow'))
          : h('button', { class: 'btn', onclick: change('add', 'allowlist', domain, 'ok', 'toastAllowed') }, t('allow')),
        rule === 'deny'
          ? h('button', { class: 'btn', onclick: change('del', 'denylist', deniedBy, 'warn', 'toastUndenied') }, t('undeny'))
          : h('button', { class: 'btn danger', onclick: change('add', 'denylist', domain, 'bad', 'toastDenied') }, t('deny'))));
    siteCard.dataset.key = 'site';
    out.push(siteCard);
  }

  // Zuletzt blockiert – hilfreich, wenn eine Seite gerade nicht richtig lädt.
  const seen = new Map();
  for (const r of (ok(bl) && ok(bl).rows) || []) {
    if (!seen.has(r.domain)) seen.set(r.domain, { ...r, n: 1 }); else seen.get(r.domain).n++;
  }
  const recent = [...seen.values()].slice(0, 8);
  out.push(card(t('recentBlocked'),
    recent.length ? h('ul', { class: 'rows' }, recent.map((r) => h('li', { 'data-key': 'blk:' + r.domain },
      h('span', { class: 'main', title: r.reason || '' },
        h('span', { class: 'name mono' }, r.domain),
        h('span', { class: 'sub' }, [r.clientName || r.client, ago(r.t), r.n > 1 ? '×' + r.n : ''].filter(Boolean).join(' · '))),
      h('button', { class: 'btn mini', onclick: (e) => act(e.currentTarget, async () => { await node.post('/dns64/allowlist', { domain: r.domain }); flash('blk:' + r.domain, 'ok'); await refresh(); }, t('toastAllowed', r.domain)) }, t('allow')))))
      : h('div', { class: 'empty' }, bl.status === 'rejected' ? errText(bl.reason) : t('noneBlocked')),
    h('div', { class: 'btnrow' },
      h('button', { class: 'btn', onclick: (e) => act(e.currentTarget, () => node.post('/dns64/cache/flush'), t('toastFlushed')) }, t('flushCache')),
      h('button', { class: 'btn', onclick: () => openTab(uiLink('/dns64/log')) }, t('openLog')))));
  return out;
}

/* ---------- DynDNS ---------- */

function ipRow(label, fam) {
  const ip = fam && fam.ip;
  return [
    h('span', { class: 'k' }, label),
    h('span', { class: 'v mono', title: ip || '' }, ip || (fam && fam.error) || '–'),
    ip ? h('button', { class: 'btn mini', onclick: async () => {
      try { await navigator.clipboard.writeText(ip); toast(t('toastCopied')); } catch { toast(t('errorGeneric', 'clipboard'), true); }
    } }, t('copy')) : h('span', {}),
  ];
}

const TARGET_DOT = { ok: 'up', cdn: 'up', error: 'down', dns: 'warn', pending: 'warn', new: '', paused: 'paused', off: 'paused' };

async function renderDyndns(seq) {
  const out = [];
  if (node) {
    const [st, tg] = await settle([node.get('/dyndns/status'), node.get('/dyndns/targets')]);
    if (seq !== renderSeq) return null;
    if (moduleOff(st)) out.push(card('DynDNS64', h('div', { class: 'empty' }, t('moduleOff'))));
    else if (st.status === 'rejected') out.push(errorCard('DynDNS64', st.reason));
    else {
      const s = st.value || {};
      const suspect = s.connection && s.connection.suspect;
      out.push(card(t('publicIp'),
        h('div', { class: 'kv' }, ipRow('IPv4', s.ipv4), ipRow('IPv6', s.ipv6)),
        suspect ? h('div', { class: 'small', style: 'margin-top:6px;color:var(--warn)' }, t('cgnatHint', String(suspect).toUpperCase())) : null,
        h('div', { class: 'btnrow' },
          h('span', { class: 'muted small', style: 'flex:1;align-self:center' }, s.ipv4 && s.ipv4.checked_at ? t('checkedAt', ago(s.ipv4.checked_at)) : ''),
          h('button', { class: 'btn', onclick: (e) => act(e.currentTarget, async () => { await node.post('/dyndns/check'); await sleep(1500); flash('dyn-ip', 'ok'); await refresh(); }, t('toastChecking')) }, t('checkNow')))));

      const targets = ok(tg) || [];
      out.push(card(t('targets'), targets.length ? h('ul', { class: 'rows' }, targets.map((x) => h('li', { title: x.last_error || '', 'data-key': 'dyn:' + x.id },
        h('span', { class: 'dot ' + (TARGET_DOT[x.status] ?? '') }),
        h('a', { class: 'rowlink main', href: uiLink('/dyndns/targets/' + x.id), target: '_blank', rel: 'noreferrer' },
          h('span', { class: 'name mono' }, x.fqdn || x.domain),
          h('span', { class: 'sub' + (x.status === 'error' ? ' err' : '') }, x.status === 'error' && x.last_error ? x.last_error : [x.last_ipv4, x.last_ok_at ? ago(x.last_ok_at) : ''].filter(Boolean).join(' · ') || x.status)),
        h('button', { class: 'btn mini', onclick: (e) => act(e.currentTarget, async () => { await node.post(`/dyndns/targets/${x.id}/update`); await sleep(1500); flash('dyn:' + x.id, 'ok'); await refresh(); }, t('toastUpdating')) }, t('updateNow')))))
        : h('div', { class: 'empty' }, tg.status === 'rejected' ? errText(tg.reason) : t('noTargets'))));
    }
  }
  if (cloud) {
    const [dm] = await settle([cloud.get('/domains')]);
    if (seq !== renderSeq) return null;
    if (dm.status === 'rejected') out.push(errorCard(t('accountDomains'), dm.reason));
    else {
      const list = Array.isArray(dm.value) ? dm.value : [];
      out.push(card(t('accountDomains'), list.length ? h('ul', { class: 'rows' }, list.slice(0, 30).map((d) => h('li', {},
        h('span', { class: 'dot ' + (d.active === false ? 'paused' : 'up') }),
        h('span', { class: 'main' }, h('span', { class: 'name mono' }, d.name)),
        h('span', { class: 'val' }, d.kind || ''))))
        : h('div', { class: 'empty' }, t('noDomains'))));
    }
  }
  return out;
}

/* ---------- Rahmen ---------- */

const RENDER = { overview: renderOverview, checks: renderChecks, dns: renderDns, dyndns: renderDyndns };

function setHeader(n) {
  if (!n) return;
  document.getElementById('nodeName').textContent = n.name || 'Node64';
  document.getElementById('nodeMeta').textContent = [n.version && 'v' + String(n.version).replace(/^v/, ''), n.uptime_seconds ? t('uptime', uptime(n.uptime_seconds)) : '', n.location].filter(Boolean).join(' · ');
}

async function refresh(showSkeleton) {
  const seq = ++renderSeq;
  const btn = document.getElementById('btnRefresh');
  const bar = document.getElementById('progress');
  btn.classList.add('spin');
  bar.classList.add('on');
  clearInterval(ticker);
  if (showSkeleton) view.replaceChildren(h('div', { class: 'skeleton' }), h('div', { class: 'skeleton' }));
  let nodes;
  try {
    nodes = await RENDER[currentTab](seq);
  } catch (e) {
    nodes = [errorCard('', e)];
  }
  if (seq !== renderSeq || nodes === null) return;
  const scroll = view.scrollTop;
  view.replaceChildren(...(nodes.length ? nodes : [h('div', { class: 'empty' }, '–')]));
  view.scrollTop = showSkeleton ? 0 : scroll;
  btn.classList.remove('spin');
  bar.classList.remove('on');
  applyFlash();
  const failed = nodes.length && nodes.every((n) => n.querySelector && n.querySelector(':scope > .err'));
  const stamp = document.getElementById('stamp');
  stamp.textContent = 'v' + EXT_VERSION + ' · ' + t('updatedAt', new Date().toLocaleTimeString(LANG));
  stamp.classList.remove('blink'); void stamp.offsetWidth; stamp.classList.add('blink');
  document.getElementById('conn').className = 'conn ' + (failed ? 'down' : 'up');
  document.getElementById('conn').title = t(failed ? 'connDown' : 'connUp');
  chrome.runtime.sendMessage({ type: 'poll' }).catch(() => {});
}

function switchTab(name) {
  currentTab = name;
  for (const b of document.querySelectorAll('#tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === name));
  try { localStorage.setItem('n64-tab', name); } catch { /* egal */ }
  refresh(true);
}

const EXT_VERSION = chrome.runtime.getManifest().version;

async function init() {
  document.getElementById('stamp').textContent = 'v' + EXT_VERSION;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-title]')) { el.title = t(el.dataset.i18nTitle); el.setAttribute('aria-label', el.title); }
  if (new URLSearchParams(location.search).has('page')) document.body.classList.add('page');

  document.getElementById('btnOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
  document.getElementById('btnRefresh').addEventListener('click', async () => { await refresh(); toast(t('toastRefreshed')); });

  cfg = await N64.getConfig();
  node = N64.node(cfg);
  cloud = N64.ipv64(cfg);

  if (!node && !cloud) {
    document.getElementById('tabs').hidden = true;
    view.replaceChildren(card(t('notConfiguredTitle'),
      h('p', { style: 'margin:0 0 10px' }, t('notConfiguredText')),
      h('button', { class: 'btn primary', onclick: () => chrome.runtime.openOptionsPage() }, t('openSettings'))));
    return;
  }
  if (node) {
    const open = document.getElementById('btnOpen');
    open.hidden = false;
    open.addEventListener('click', () => openTab(node.url + '/'));
  } else {
    document.getElementById('nodeName').textContent = 'ipv64.net';
    document.querySelector('[data-tab="dns"]').hidden = true;
  }
  for (const b of document.querySelectorAll('#tabs button')) b.addEventListener('click', () => switchTab(b.dataset.tab));

  let start = 'overview';
  try { start = localStorage.getItem('n64-tab') || start; } catch { /* egal */ }
  if (!RENDER[start] || (start === 'dns' && !node)) start = 'overview';
  switchTab(start);

  // Solange das Popup offen ist, alle 15 s neu laden – außer während einer Aktion oder beim Tippen.
  setInterval(() => {
    const el = document.activeElement;
    if (!busy && !document.querySelector('.btn.busy') && !(el && el.tagName === 'INPUT')) refresh();
  }, 15000);
}

init();
