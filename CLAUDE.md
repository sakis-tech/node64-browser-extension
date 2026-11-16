# Node64 Browser Extension – Regeln für Claude

Inoffizielles Browser-Addon für Node64 (ipv64net/node64) und ipv64.net, für Firefox (ab 128) und Chrome/Chromium aus einer Codebasis. Betreuer: Sakis (sakis-tech), kein Programmierer – Erklärungen in Issues und PRs einfach halten.

## Aufbau

- `src/` – der Addon-Code, wird so in die ZIPs gepackt. Manifest V3, reines JavaScript, keine Abhängigkeiten, kein Bundler.
  - `manifest.json` (Chrome), `manifest.firefox.json` (Abweichungen für Firefox, wird beim Bauen darübergelegt)
  - `lib/api.js` Node64- und ipv64.net-API, `background.js` Polling/Badge/Benachrichtigungen/Kontextmenü, `popup.*`, `options.*`
  - `_locales/de` und `_locales/en` – **jeder neue Text in beide Sprachen**
- `.github/scripts/build.py` baut `dist/chrome`, `dist/firefox` und die ZIPs, `.github/scripts/chrome_upload.py` lädt in den Chrome Web Store hoch.
- Das README ist nur für Nutzer: keine Abschnitte zu Entwicklung, Aufbau oder Workflows dort einfügen.
- `docs/` Bilder und Store-Texte, `CHANGELOG.md`, `PRIVACY.md`.

## Regeln für Änderungen

- Kleine, gezielte Fixes. Keinen Code umbauen, der mit dem Fehler nichts zu tun hat.
- Keine neuen Abhängigkeiten, kein Build-Werkzeug, kein Framework.
- API-Daten nie per `innerHTML` ins DOM, immer als Text (siehe `h()` in `popup.js`).
- Muss in Chrome (Service Worker) **und** Firefox (Hintergrundseite) laufen. `lib/api.js` bleibt ohne ES-Module.
- Keine neuen Berechtigungen im Manifest ohne ausdrückliche Zustimmung von Sakis – sonst prüfen die Stores neu und Nutzer müssen zustimmen.
- Die Icons (`src/icons/`) nicht verändern oder ersetzen.
- Das Addon sendet Daten nur an die eingetragene Node64 und an ipv64.net. Daran nichts ändern, keine Telemetrie.

## Jeder Fix bekommt eine neue Version

1. Patch-Version in `src/manifest.json` um eins erhöhen (z. B. 0.2.2 → 0.2.3).
2. In `CHANGELOG.md` oben einen Abschnitt `## <Version> – <JJJJ-MM-TT>` mit kurzen, verständlichen Stichpunkten auf Deutsch ergänzen, mit Verweis auf das Issue (`#12`).
3. `python3 .github/scripts/build.py` und `npx --yes web-ext@10 lint --source-dir dist/firefox` müssen ohne Fehler durchlaufen.

Nach dem Merge auf `main` legt `.github/workflows/release.yml` den GitHub-Release an und lädt die Version zu Firefox Add-ons und in den Chrome Web Store hoch (Chrome nur, wenn die Secrets `CWS_SERVICE_ACCOUNT_JSON` und `CWS_PUBLISHER_ID` gesetzt sind).

## Store-Einträge

- Firefox Add-ons: https://addons.mozilla.org/de/firefox/addon/node64-browser-extension/
- Chrome Web Store: https://chromewebstore.google.com/detail/node64-browser-extension/bjcjjbcpkmmfaaebjgoaiobjhakhoima (ID `bjcjjbcpkmmfaaebjgoaiobjhakhoima`)

## Ehrlichkeit

Nichts behaupten, was nicht geprüft ist. Wenn ein Fehler nicht nachvollziehbar ist oder die Ursache unsicher bleibt, das im Issue bzw. PR offen sagen statt zu raten.
