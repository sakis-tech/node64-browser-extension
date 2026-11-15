/* Erfundene Testdaten für die Screenshots. IP-Adressen aus den Dokumentationsbereichen
 * (203.0.113.0/24, 2001:db8::/32), Domains mit example.* bzw. frei erfunden. */
(function () {
  'use strict';
  const LANG = new URLSearchParams(location.search).get('lang') || 'en';
  const de = LANG === 'de';
  const now = Date.now();
  const ago = (s) => new Date(now - s * 1000).toISOString();
  const inDays = (d) => new Date(now + d * 86400000 + 3600000).toISOString();

  const st = (state, sAgo, ms, extra) => ({ state, last_check_at: ago(sAgo), last_latency_ms: ms, ...extra });
  const checks = [
    { token: 'c1', name: 'Pi-hole DNS', type: 'dns', target: '192.168.1.2', state: st('down', 40, 0, { last_message: de ? 'Zeitüberschreitung nach 5 s' : 'timeout after 5 s', down_since: ago(780) }) },
    { token: 'c2', name: de ? 'Zertifikat example.org' : 'Certificate example.org', type: 'tls', target: 'example.org:443', state: st('degraded', 50, 120, { last_message: de ? 'läuft in 9 Tagen ab' : 'expires in 9 days' }) },
    { token: 'c3', name: 'Backup-Cron', type: 'push', target: '', state: st('up', 42, 0) },
    { token: 'c4', name: 'Home Assistant', type: 'http', target: 'http://ha.local:8123', state: st('up', 35, 41) },
    { token: 'c5', name: 'Jellyfin', type: 'tcp', target: '192.168.1.20:8096', state: st('up', 33, 3) },
    { token: 'c6', name: 'Nextcloud', type: 'http', target: 'https://cloud.example.org', state: st('up', 31, 84) },
    { token: 'c7', name: 'Router', type: 'icmp', target: '192.168.1.1', paused: true, state: st('paused', 3600, 1) },
  ];

  const blocked = [
    ['ads.doubleclick.net', de ? 'Laptop' : 'Laptop', 70], ['ads.doubleclick.net', 'Laptop', 95],
    ['telemetry.example-tv.com', 'TV', 190], ['tracker.adnetwork.io', de ? 'Handy' : 'Phone', 420],
    ['metrics.app-analytics.net', 'Tablet', 900],
  ].map(([domain, clientName, s]) => ({ domain, clientName, client: '192.168.1.' + (10 + s % 40), t: ago(s), status: 'blocked' }));

  const site = 'news.example.com';
  const siteRows = [];
  for (let i = 0; i < 38; i++) siteRows.push({ domain: i % 9 === 4 ? 'ads.news.example.com' : i % 5 === 1 ? 'img.news.example.com' : site, t: ago(30 + i * 40), status: i % 9 === 4 ? 'blocked' : 'ok' });

  const favicon = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="#7c3aed"/><path d="M4 12V4l8 8V4" stroke="#fff" stroke-width="2" fill="none"/></svg>');

  const NODE = {
    '/status': () => ({
      node: { name: 'raspberrypi', version: '1.4.2', uptime_seconds: 3 * 86400 + 11 * 3600 + 120 },
      modules: [
        { name: 'healthchecks', enabled: true, running: true, path: '/healthchecks' },
        { name: 'dns64', enabled: true, running: true, path: '/dns64' },
        { name: 'dyndns', enabled: true, running: true, path: '/dyndns' },
        { name: 'cdn64', enabled: true, running: true, path: '/proxy' },
        { name: 'honeypot', enabled: true, running: true, path: '/honeypot' },
        { name: 'monitor64', enabled: false, running: false, path: '/monitor' },
      ],
      boards: [{ module: 'healthchecks', ok: 4, down: 1 }],
      link: { linked: true, connected: true, plan: 'Free' },
    }),
    '/version': () => ({ version: '1.4.2', hostname: 'raspberrypi' }),
    '/users/me': () => ({ username: 'admin' }),
    '/checks': () => checks,
    '/certs': () => [
      { id: 1, names: ['example.org'], not_after: inDays(8), status: 'valid' },
      { id: 2, names: ['cloud.example.org'], not_after: inDays(61), status: 'valid' },
    ],
    '/dns64/summary': () => ({ summary: { total: 48213, blocked: 6120, clients: 14 } }),
    '/dns64/status': () => ({ blocking: { paused: false } }),
    '/dns64/log': (q) => ({ rows: q.get('q') ? siteRows : blocked }),
    '/dns64/allowlist': () => [{ domain: 'example.net' }],
    '/dns64/denylist': () => [{ domain: 'adnetwork.io' }],
    '/dyndns/status': () => ({ ipv4: { ip: '203.0.113.47', checked_at: ago(130) }, ipv6: { ip: '2001:db8:4a2::1' } }),
    '/dyndns/targets': () => [
      { id: 1, fqdn: 'home.example.ipv64.net', status: 'ok', last_ipv4: '203.0.113.47', last_ok_at: ago(3700) },
      { id: 2, fqdn: 'pi.example.ipv64.de', status: 'ok', last_ipv4: '203.0.113.47', last_ok_at: ago(3900) },
    ],
  };

  const CLOUD = {
    '/me': () => ({ username: 'demo', plan: { name: 'Free' }, usage: {
      domains: { used: 3, limit: 5 }, dyndns_updates: { used: 412, limit: 1000 }, healthchecks: { used: 7, limit: 10 } } }),
    '/domains': () => [
      { name: 'example.ipv64.net', kind: 'DynDNS', active: true },
      { name: 'example.ipv64.de', kind: 'DynDNS', active: true },
      { name: 'demo.any64.de', kind: 'DynDNS', active: false },
    ],
  };

  window.DEMO = {
    node: (path, q) => (NODE[path] ? NODE[path](q) : undefined),
    cloud: (path) => (CLOUD[path] ? CLOUD[path]() : undefined),
    activeTab: { id: 1, url: 'https://' + site + '/tech/2026/node64-release', favIconUrl: favicon },
  };
})();
