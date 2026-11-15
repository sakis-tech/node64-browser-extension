# Changelog – Node64 Browser Extension

Was sich je Version ändert. Die installierte Version steht im Popup unten rechts („Node64 Browser Extension v…“) und am Ende der Einstellungen.

## 0.2.2 – 2026-11-15

- Popup: Die Versionen sind jetzt beschriftet – oben „Node64 v…“ für die Version der Node, unten rechts „Node64 Browser Extension v…“ für die Version des Addons.
- Repository aufgeräumt: Der Quellcode liegt jetzt in `src/`, die Pakete gibt es als ZIP unter Releases. Neue Screenshots für README, Chrome Web Store und Firefox Add-ons (`docs/`). Am Addon selbst ändert sich dadurch nichts.

## 0.2.1 – 2026-11-15

- **Firefox: Verbindung zu Nodes über `http://` behoben.** Firefox stellt bei Manifest-V3-Addons jede `http://`-Anfrage automatisch auf `https://` um (Richtlinie `upgrade-insecure-requests`). Eine Node, die nur per HTTP erreichbar ist (z. B. `http://192.168.1.100:8064`), meldete deshalb „Node nicht erreichbar (Netzwerk, Adresse oder Zertifikat prüfen)“. Das Addon setzt jetzt eine eigene Sicherheitsrichtlinie ohne diese Umstellung. In Chrome ändert sich nichts.
- Versionsnummer des Addons im Popup (unten rechts) und am Ende der Einstellungen.
- Einstellungen: Ein erfolgreicher „Verbindung testen“ speichert Adresse und Key gleich mit. Antwortet unter der Adresse etwas anderes als die Node64-API, sagt das Addon das jetzt statt eines falschen Erfolgs.
- DNS64 „Diese Seite“: Die offene Seite steht als Adressleiste mit Favicon und Schloss bzw. „Nicht sicher“. Es erscheinen nur Aktionen, die etwas ändern: Freigeben ist ausgegraut, wenn laut Log nichts blockiert wird, und Sperren, wenn die Seite schon blockiert ist.
- DNS64: Nach dem Freigeben oder Sperren (Popup und Rechtsklick-Menü) leert das Addon den DNS-Cache der Node und lädt die Seite ohne Browser-Cache neu, damit die Änderung sofort wirkt.
- Popup: Ausgeblendete Elemente bleiben zuverlässig unsichtbar.
- README: Installation in Firefox direkt über Firefox Add-ons.

## 0.2.0

- Erste veröffentlichte Version: Übersicht, Healthchecks, DNS64, DynDNS, Kontextmenü, Deutsch und Englisch.
