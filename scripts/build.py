#!/usr/bin/env python3
"""Baut dist/chrome und dist/firefox samt ZIPs.

Der Quellcode liegt in src/. src/manifest.json ist das Chrome-Manifest; für
Firefox werden die Schlüssel aus src/manifest.firefox.json darübergelegt
(Hintergrundseite statt Service Worker). LICENSE kommt aus dem Hauptordner."""
import json, shutil, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
FILES = ["background.js", "popup.html", "popup.css", "popup.js", "options.html", "options.js"]
DIRS = ["lib", "icons", "_locales"]

base = json.loads((SRC / "manifest.json").read_text(encoding="utf-8"))
targets = {"chrome": base, "firefox": {**base, **json.loads((SRC / "manifest.firefox.json").read_text(encoding="utf-8"))}}
dist = ROOT / "dist"
shutil.rmtree(dist, ignore_errors=True)

for name, manifest in targets.items():
    out = dist / name
    out.mkdir(parents=True)
    for f in FILES:
        shutil.copy2(SRC / f, out / f)
    shutil.copy2(ROOT / "LICENSE", out / "LICENSE")
    for d in DIRS:
        shutil.copytree(SRC / d, out / d, ignore=shutil.ignore_patterns("*.svg"))
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    zpath = dist / f"node64-browser-extension-{base['version']}-{name}.zip"
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(out.rglob("*")):
            if p.is_file():
                z.write(p, p.relative_to(out).as_posix())
    print(zpath.relative_to(ROOT))
