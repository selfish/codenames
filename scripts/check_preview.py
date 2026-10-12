"""Check the published preview over HTTPS from a desktop and mobile browser."""

import json
import os
from pathlib import Path
import shutil
import time
from urllib.request import urlopen

from playwright.sync_api import sync_playwright

PR = int(os.environ.get("PREVIEW_PR", "14"))
BASE = f"https://codenames.nit.ai/pr-preview/pr-{PR}/"
HEAD = os.environ.get("PREVIEW_HEAD", "eb34cc11e28aba93d4bba286f2b79b090f4d820e")


def wait_for_publication():
    for attempt in range(60):
        try:
            with urlopen(BASE + "preview.json", timeout=15) as response:
                receipt = json.load(response)
                if receipt == {"pull_request": PR, "head": HEAD}:
                    return
        except (OSError, ValueError):
            pass
        print(f"Waiting for Pages publication ({attempt + 1}/60)", flush=True)
        time.sleep(10)
    raise RuntimeError("Preview did not become reachable over HTTPS")


def check():
    wait_for_publication()
    executable = shutil.which("google-chrome") or shutil.which("chromium")
    if not executable:
        raise RuntimeError("A Chromium browser is required for live verification")
    evidence = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=executable, args=["--no-sandbox"])
        for name, options in [("desktop", {"viewport": {"width": 1280, "height": 800}}), ("mobile", playwright.devices["iPhone 13"])]:
            context = browser.new_context(**options)
            page = context.new_page()
            failures, errors, requests = [], [], []
            page.on("requestfailed", lambda request: failures.append({"url": request.url, "error": request.failure}))
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("request", lambda request: requests.append(request.url))
            response = page.goto(BASE, wait_until="networkidle")
            assert response.status == 200
            assert page.title() == "Codenames | nit.ai"
            assert page.locator('meta[name="robots"]').get_attribute("content") == "noindex, nofollow, noimageindex"
            cdp = context.new_cdp_session(page)
            manifest_result = cdp.send("Page.getAppManifest")
            assert not manifest_result["errors"], manifest_result["errors"]
            resources = page.evaluate("""async () => {
              const manifestURL = document.querySelector('link[rel=manifest]').href;
              const response = await fetch(manifestURL);
              if (!response.ok) throw new Error('Manifest HTTP ' + response.status);
              const manifest = await response.json();
              if (manifest.scope !== './' || manifest.start_url !== './') throw new Error('Preview scope');
              const icons = [...document.querySelectorAll('link[rel=icon],link[rel=apple-touch-icon]')].map(x => x.href);
              icons.push(...manifest.icons.map(x => new URL(x.src, manifestURL).href));
              return await Promise.all(icons.map(async url => {
                if (!url.startsWith(location.href)) throw new Error('Icon escaped preview prefix');
                const response = await fetch(url);
                if (!response.ok) throw new Error('Icon HTTP ' + response.status);
                const image = new Image(); image.src = url; await image.decode();
                return {url, status: response.status, type: response.headers.get('content-type'), width: image.naturalWidth, height: image.naturalHeight};
              }));
            }""")
            expected = {"favicon.ico": (48, 48), "apple-touch-icon.png": (180, 180), "android-chrome-192x192.png": (192, 192), "android-chrome-512x512.png": (512, 512)}
            for resource in resources:
                filename = resource["url"].rsplit("/", 1)[-1]
                assert (resource["width"], resource["height"]) == expected[filename]
                assert resource["type"] in ("image/png", "image/x-icon", "image/vnd.microsoft.icon")
            page.get_by_role("button", name="Randomize").click()
            page.wait_for_function("!document.querySelector('button').disabled")
            assert page.locator(".grid.grid-cols-5 > div").count() == 25
            assert not errors, errors
            assert not any(item["url"].startswith(BASE) for item in failures), failures
            assert not any("logo192.png" in url or "logo512.png" in url for url in requests)
            page.screenshot(path=f"preview-{name}.png", full_page=True)
            evidence.append({"context": name, "url": BASE, "head": HEAD, "title": page.title(), "noindex": True, "manifest_errors": manifest_result["errors"], "icons": resources, "map_cells": 25, "external_network_failures": failures})
            context.close()
        browser.close()
    Path("preview-evidence.json").write_text(json.dumps(evidence, indent=2) + "\n")
    print(json.dumps(evidence, indent=2))


if __name__ == "__main__":
    check()
