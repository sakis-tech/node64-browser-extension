# Changelog – Node64 Browser Extension

Was sich je Version ändert. Die installierte Version steht im Popup unten rechts und am Ende der Einstellungen.

## 0.2.1 – 2026-11-15

- **Firefox: Verbindung zu Nodes über `http://` behoben.** Firefox stellt bei Manifest-V3-Addons jede `http://`-Anfrage automatisch auf `https://` um (Richtlinie `upgrade-insecure-requests`). Eine Node, die nur per HTTP erreichbar ist (z. B. `http://192.168.1.100:8064`), meldete deshalb „Node nicht erreichbar (Netzwerk, Adresse oder Zertifikat prüfen)“. Das Addon setzt jetzt eine eigene Sicherheitsrichtlinie ohne diese Umstellung. In Chrome ändert sich nichts.
- Versionsnummer des Addons im Popup (unten rechts) und am Ende der Einstellungen.
- README: Installation in Firefox direkt über Firefox Add-ons.

## 0.2.0

- Erste veröffentlichte Version: Übersicht, Healthchecks, DNS64, DynDNS, Kontextmenü, Deutsch und Englisch.
