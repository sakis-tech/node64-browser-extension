#!/usr/bin/env python3
"""Erzeugt Screenshots und Store-Bilder mit erfundenen Testdaten.

Ablauf: src/ wird in einen Temp-Ordner kopiert, popup.html und options.html bekommen
shim.js + demo-data.js vorangestellt (ersetzt chrome.* und alle API-Antworten). Ein
Chromium (Playwright) fotografiert dann das echte Popup bzw. die Einstellungen; die
Store-Bilder werden aus slides.html zusammengesetzt.

    pip install playwright && python -m playwright install chromium
    python3 scripts/screenshots/make.py            # alles nach docs/
    CHROME=/usr/bin/google-chrome python3 scripts/screenshots/make.py
"""
import functools, http.server, os, shutil, tempfile, threading, json
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
DOCS = ROOT / "docs"
LANGS = ["de", "en"]
TABS = ["overview", "checks", "dns", "dyndns"]


def prepare(web: Path):
    ext = web / "ext"
    shutil.copytree(ROOT / "src", ext)
    for f in ["shim.js", "demo-data.js"]:
        shutil.copy2(HERE / f, ext / f)
    inject = '<script src="demo-data.js"></script>\n<script src="shim.js"></script>\n<script src="lib/api.js"></script>'
    for page in ["popup.html", "options.html"]:
        p = ext / page
        p.write_text(p.read_text(encoding="utf-8").replace('<script src="lib/api.js"></script>', inject, 1), encoding="utf-8")
    shutil.copy2(HERE / "slides.html", web / "slides.html")
    shutil.copy2(ROOT / "src" / "icons" / "icon-128.png", web / "icon-128.png")


def serve(web: Path):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    handler = functools.partial(Quiet, directory=str(web))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_port}"


def main():
    web = Path(tempfile.mkdtemp()) / "web"
    prepare(web)
    srv, base = serve(web)
    raw = web / "raw"
    raw.mkdir()
    launch = {"executable_path": os.environ["CHROME"]} if os.environ.get("CHROME") else {}
    with sync_playwright() as pw:
        browser = pw.chromium.launch(**launch)
        ctx = browser.new_context(viewport={"width": 400, "height": 200}, device_scale_factor=2, color_scheme="light")
        page = ctx.new_page()
        for lang in LANGS:
            for tab in TABS:
                cloud = "&cloud=1" if tab == "dyndns" else ""
                page.goto(f"{base}/ext/popup.html?lang={lang}&tab={tab}{cloud}")
                page.wait_for_selector("html[data-ready='1']")
                page.add_style_tag(content="#toast{display:none!important}")
                page.screenshot(path=str(raw / f"popup-{lang}-{tab}.png"), full_page=True)
            page.set_viewport_size({"width": 640, "height": 400})
            page.goto(f"{base}/ext/options.html?lang={lang}&cloud=1")
            page.wait_for_timeout(500)
            page.click("#testNode")
            page.click("#testCloud")
            page.mouse.move(0, 0)
            page.evaluate("document.activeElement.blur()")
            page.wait_for_timeout(700)
            page.screenshot(path=str(raw / f"options-{lang}.png"), full_page=True)
            page.set_viewport_size({"width": 400, "height": 200})
        ctx.close()

        # README: reine Popup-Bilder
        img = DOCS / "images"
        img.mkdir(parents=True, exist_ok=True)
        for tab in TABS:
            shutil.copy2(raw / f"popup-de-{tab}.png", img / f"popup-{tab}.png")
        shutil.copy2(raw / "options-de.png", img / "options.png")

        # Store-Bilder aus slides.html
        slides = json.loads((HERE / "slides.json").read_text(encoding="utf-8"))
        ctx = browser.new_context(device_scale_factor=1, color_scheme="light")
        page = ctx.new_page()
        for item in slides:
            w, h = item["size"]
            page.set_viewport_size({"width": w, "height": h})
            q = "&".join(f"{k}={v}" for k, v in item["query"].items())
            page.goto(f"{base}/slides.html?{q}")
            page.wait_for_selector("html[data-ready='1']")
            out = DOCS / item["out"]
            out.parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(out))
            print(out.relative_to(ROOT))
        browser.close()
    srv.shutdown()


if __name__ == "__main__":
    main()
