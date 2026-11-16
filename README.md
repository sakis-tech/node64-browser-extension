# Node64 Browser Extension

Inoffizielles Browser-Addon für [Node64](https://github.com/ipv64net/node64) und [ipv64.net](https://ipv64.net) – für Chrome/Chromium und Firefox aus einer Codebasis (Manifest V3, reines JavaScript, kein Build-Schritt).

> Kein offizielles Projekt von IPv64.net. Node64 und IPv64.net sind Namen ihrer jeweiligen Inhaber.

<p>
  <img src="docs/images/popup-overview.png" alt="Reiter Übersicht" width="200">
  <img src="docs/images/popup-checks.png" alt="Reiter Checks" width="200">
  <img src="docs/images/popup-dns.png" alt="Reiter DNS64" width="200">
  <img src="docs/images/popup-dyndns.png" alt="Reiter DynDNS" width="200">
</p>

<sub>Screenshots mit Testdaten.</sub>

## Funktionen

- **Übersicht** – Node-Name, Version, Laufzeit, Zustand aller Module, Zertifikate mit Handlungsbedarf, Verknüpfung mit ipv64.net, Kontingente des ipv64.net-Kontos.
- **Healthchecks** – alle Checks mit Zustand und Latenz, Filter, „Jetzt prüfen“, Pausieren/Fortsetzen. Gestörte Checks stehen als Zahl am Symbol, Ausfälle kommen als Browser-Benachrichtigung.
- **DNS64** – Filter-Status, Kennzahlen der letzten 24 Stunden, Blockieren für 5/30/60 Minuten oder unbegrenzt pausieren, Cache leeren. Für die gerade offene Seite: Domain freigeben oder sperren. Dazu die zuletzt blockierten Domains mit Freigabe per Klick.
- **DynDNS** – öffentliche IPv4/IPv6 mit Kopieren, Hinweis auf CGNAT/DS-Lite, Ziele mit Zustand und „Aktualisieren“, Domains aus dem ipv64.net-Konto.
- **Kontextmenü** – Rechtsklick auf Seite oder Link: Domain in DNS64 freigeben bzw. sperren.
- Deutsch und Englisch, helles und dunkles Design.

## Installation

Am einfachsten über die Stores – dort kommen Updates automatisch:

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/bjcjjbcpkmmfaaebjgoaiobjhakhoima?label=Chrome%20Web%20Store&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/node64-browser-extension/bjcjjbcpkmmfaaebjgoaiobjhakhoima)
[![Firefox Add-ons](https://img.shields.io/amo/v/node64-browser-extension?label=Firefox%20Add-ons&logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/de/firefox/addon/node64-browser-extension/)

Fertige Pakete für jede Version gibt es außerdem unter **[Releases](https://github.com/sakis-tech/node64-browser-extension/releases/latest)**: je eine ZIP für Chrome und für Firefox. Was sich geändert hat, steht im [Changelog](CHANGELOG.md).

### Firefox (ab 128)

**Empfohlen:** **[➜ Node64 Browser Extension bei Firefox Add-ons](https://addons.mozilla.org/de/firefox/addon/node64-browser-extension/)** – dort auf **Zu Firefox hinzufügen** klicken. Updates kommen automatisch.

<details>
<summary>Aus der ZIP (ohne Store, z. B. zum Testen)</summary>

Firefox installiert dauerhaft nur von Mozilla signierte Addons. Die ZIP aus den Releases lässt sich deshalb nur bis zum nächsten Neustart laden:

1. `node64-browser-extension-<Version>-firefox.zip` herunterladen (nicht entpacken).
2. `about:debugging#/runtime/this-firefox` öffnen.
3. **Temporäres Add-on laden …** klicken und die ZIP auswählen.

</details>

### Chrome, Edge, Brave und andere Chromium-Browser

**Empfohlen:** **[➜ Node64 Browser Extension im Chrome Web Store](https://chromewebstore.google.com/detail/node64-browser-extension/bjcjjbcpkmmfaaebjgoaiobjhakhoima)** – dort auf **Hinzufügen** klicken. Updates kommen automatisch. Das funktioniert auch in Edge, Brave und anderen Chromium-Browsern (Edge fragt einmalig, ob Erweiterungen aus anderen Stores erlaubt werden sollen).

<details>
<summary>Aus der ZIP (ohne Store, z. B. zum Testen)</summary>

1. `node64-browser-extension-<Version>-chrome.zip` herunterladen und **entpacken**, am besten in einen Ordner, der dauerhaft bleibt (z. B. unter Dokumente). Der Browser lädt das Addon bei jedem Start aus diesem Ordner.
2. `chrome://extensions` öffnen (Edge: `edge://extensions`, Brave: `brave://extensions`) und den **Entwicklermodus** einschalten.
3. **Entpackte Erweiterung laden** und den entpackten Ordner wählen (der Ordner, in dem `manifest.json` liegt).

Update auf eine neue Version: neue ZIP in denselben Ordner entpacken (alte Dateien ersetzen) und auf der Erweiterungsseite beim Addon auf **Neu laden** klicken. Die Einstellungen bleiben erhalten.

</details>

## Einrichtung

1. In Node64 unter **Einstellungen** einen API-Key anlegen (beginnt mit `node64_`, wird nur einmal angezeigt).
2. In den Einstellungen des Addons Adresse (z. B. `http://raspberrypi.local:8080`) und Key eintragen, **Verbindung testen**, **Speichern**. Der Browser fragt dabei einmalig nach dem Zugriff auf genau diese Adresse.
3. Optional einen API-Key von ipv64.net eintragen – dann zeigt das Addon Konto und Domains auch, wenn die Node nicht erreichbar ist.

Die Adresse darf `http://` oder `https://` sein. Läuft Node64 per HTTPS mit einem selbst signierten Zertifikat, muss der Browser diesem Zertifikat vertrauen, sonst schlägt die Abfrage fehl.

## Berechtigungen

- `storage` – Einstellungen und Keys, nur lokal in diesem Browser.
- `alarms`, `notifications` – regelmäßige Abfrage und Meldungen bei Ausfällen.
- `activeTab` – Domain der offenen Seite lesen, wenn das Popup geöffnet wird.
- `contextMenus` – die beiden Einträge im Rechtsklick-Menü.
- Host-Zugriff: fest nur `https://ipv64.net/*`; die Adresse der eigenen Node wird beim Speichern einzeln angefragt.

Das Addon sendet Daten ausschließlich an die eingetragene Node64 und an ipv64.net. Anfragen gehen ohne Cookies raus (`credentials: 'omit'`), die Sitzung des Web-UI wird nie mitbenutzt. Details in der [Datenschutzerklärung](PRIVACY.md).

## Fehler melden und Wünsche

Bitte über **[Issues](https://github.com/sakis-tech/node64-browser-extension/issues/new/choose)**. Fixes werden erst nach Prüfung durch den Betreuer übernommen.

Bitte keine API-Keys, Passwörter oder öffentlichen IP-Adressen in Issues posten.

## Lizenz

MIT
