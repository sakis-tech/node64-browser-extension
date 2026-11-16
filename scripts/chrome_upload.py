"""Lädt die Chrome-ZIP in den Chrome Web Store hoch und reicht sie zur Prüfung ein.

Wird von .github/workflows/release.yml aufgerufen. Nutzt die Chrome Web Store API (V2)
mit einem Google-Cloud-Dienstkonto.

Umgebungsvariablen:
  CWS_SERVICE_ACCOUNT_JSON  Inhalt der JSON-Schlüsseldatei des Dienstkontos
  CWS_PUBLISHER_ID          Publisher-ID aus dem Chrome Web Store Developer Dashboard (Bereich „Konto“)

Aufruf: python3 scripts/chrome_upload.py dist/node64-browser-extension-<Version>-chrome.zip
"""
import json
import os
import sys
import time

import google.auth.transport.requests
import requests
from google.oauth2 import service_account

EXTENSION_ID = "bjcjjbcpkmmfaaebjgoaiobjhakhoima"
SCOPE = "https://www.googleapis.com/auth/chromewebstore"
BASE = "https://chromewebstore.googleapis.com"


def main(zip_path):
    publisher = os.environ["CWS_PUBLISHER_ID"].strip()
    info = json.loads(os.environ["CWS_SERVICE_ACCOUNT_JSON"])
    creds = service_account.Credentials.from_service_account_info(info, scopes=[SCOPE])
    creds.refresh(google.auth.transport.requests.Request())
    headers = {"Authorization": f"Bearer {creds.token}"}
    item = f"publishers/{publisher}/items/{EXTENSION_ID}"

    print(f"Lade {zip_path} hoch …")
    with open(zip_path, "rb") as f:
        r = requests.post(f"{BASE}/upload/v2/{item}:upload", headers=headers, data=f, timeout=300)
    print(r.status_code, r.text)
    r.raise_for_status()
    state = r.json().get("uploadState")

    # Große Pakete verarbeitet der Store manchmal erst noch – dann den Status abfragen.
    for _ in range(30):
        if state != "IN_PROGRESS":
            break
        time.sleep(10)
        s = requests.get(f"{BASE}/v2/{item}:fetchStatus", headers=headers, timeout=60)
        s.raise_for_status()
        state = s.json().get("lastAsyncUploadState")
        print("Upload-Status:", state)

    if state != "SUCCEEDED":
        sys.exit(f"::error::Upload in den Chrome Web Store nicht erfolgreich (Status: {state}).")

    print("Reiche zur Prüfung ein …")
    p = requests.post(f"{BASE}/v2/{item}:publish", headers=headers, timeout=60)
    print(p.status_code, p.text)
    p.raise_for_status()
    print("Fertig. Google prüft die Version jetzt; nach der Freigabe erscheint sie automatisch im Store.")


if __name__ == "__main__":
    main(sys.argv[1])
