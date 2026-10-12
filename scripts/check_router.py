"""Compare production URL/navigation behavior before and after router removal.

Usage: python3 scripts/check_router.py BASELINE_URL CANDIDATE_URL OUTPUT_DIRECTORY
Requires Playwright and an installed Chromium browser. No server or deploy step.
"""

import json
from pathlib import Path
import shutil
import sys

from playwright.sync_api import sync_playwright

ROOT_PATHS = ["", "?game=sample", "#", "#/", "#/?game=sample", "#/#section", "#?game=sample", "#//", "#///", "#/?q=%2F"]
UNKNOWN_PATHS = ["#missing", "#/missing", "#/missing?x=1", "#/missing#section", "#/%2F", "#%2f", "#/%", "#/%2e", "#/.", "#/..", "#%3Fquery", "#%23section"]


def snapshot(page):
    return page.evaluate("""() => ({
      html: document.querySelector('#root').innerHTML,
      title: document.title,
      overflow: document.documentElement.scrollWidth > innerWidth,
      cells: [...document.querySelectorAll('[data-testid=map-cell]')].map(el => {
        const r = el.getBoundingClientRect();
        return {x:r.x, y:r.y, width:r.width, height:r.height, color:el.style.backgroundColor};
      })
    })""")


def ready(page):
    page.wait_for_function("document.querySelector('#root').childElementCount > 0")
    page.add_style_tag(content="* { animation: none !important; transition: none !important; }")
    page.evaluate("document.fonts.ready")


def check_one(browser, base, width, output, label):
    context = browser.new_context(viewport={"width": width, "height": 800})
    context.add_init_script("Math.random = () => 0.17;")
    page = context.new_page()
    routes = []
    for suffix in ROOT_PATHS + UNKNOWN_PATHS:
        url = base + suffix
        page.goto("about:blank")
        response = page.goto(url, wait_until="domcontentloaded")
        assert response.status == 200
        ready(page)
        expected_map = suffix in ROOT_PATHS
        assert (page.get_by_role("button", name="Randomize").count() == 1) == expected_map
        before = snapshot(page)
        assert not before["overflow"]
        assert page.url == url or suffix == "#" and page.url == base
        page.reload(wait_until="domcontentloaded")
        ready(page)
        assert snapshot(page) == before, "Reload changed visible content or geometry"
        routes.append({"suffix": suffix, "snapshot": before})

    page.goto(base, wait_until="domcontentloaded")
    ready(page)
    page.get_by_role("button", name="Randomize").click()
    page.wait_for_function("!document.querySelector('button').disabled")
    randomized = snapshot(page)
    assert len(randomized["cells"]) == 25
    assert not randomized["overflow"]
    counts = {}
    for cell in randomized["cells"]:
        counts[cell["color"]] = counts.get(cell["color"], 0) + 1
    assert sorted(counts.values()) == [1, 7, 8, 9]
    # Real hash changes and browser history must preserve the active board.
    page.evaluate("location.hash = '/?game=sample'")
    page.wait_for_url(base + "#/?game=sample")
    assert snapshot(page) == randomized
    page.go_back(wait_until="domcontentloaded")
    page.wait_for_url(base)
    assert snapshot(page) == randomized
    page.go_forward(wait_until="domcontentloaded")
    page.wait_for_url(base + "#/?game=sample")
    assert snapshot(page) == randomized
    page.screenshot(path=str(output / f"{label}-{width}.png"), full_page=True)
    page.evaluate("location.hash = '/missing'")
    page.get_by_role("heading", name="404 Not Found").wait_for()
    page.go_back(wait_until="domcontentloaded")
    page.get_by_role("button", name="Randomize").wait_for()
    reset = snapshot(page)
    assert reset == routes[0]["snapshot"], "Returning from 404 must mount a fresh map"
    context.close()
    return {"width": width, "routes": routes, "randomized": randomized, "history_and_reset": "passed"}


def check(baseline, candidate, output):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    executable = shutil.which("google-chrome") or shutil.which("chromium")
    if not executable:
        raise RuntimeError("Chromium is required")
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=executable, args=["--no-sandbox"])
        for width in [320, 360, 412, 1280]:
            before = check_one(browser, baseline, width, output, "baseline")
            after = check_one(browser, candidate, width, output, "candidate")
            assert before == after, f"Navigation or rendering differs at {width}px"
            results.append({"width": width, "direct_and_reload_cases": len(before["routes"]), "history_and_reset": "passed", "dom_and_cell_geometry": "identical", "horizontal_overflow": False})
            print(json.dumps(results[-1]), flush=True)
        page = browser.new_page()
        page.goto(candidate, wait_until="domcontentloaded")
        robots = page.locator('meta[name="robots"]')
        noindex = robots.count() == 1 and robots.get_attribute("content") == "noindex, nofollow, noimageindex"
        if "/pr-preview/" in candidate:
            assert noindex, "Published preview must opt out of indexing"
        title = page.title()
        browser.close()
    evidence = {"baseline": baseline, "candidate": candidate, "document_title": title, "noindex": noindex, "results": results}
    (output / "router-evidence.json").write_text(json.dumps(evidence, indent=2) + "\n")
    return evidence


if __name__ == "__main__":
    check(sys.argv[1], sys.argv[2], sys.argv[3])
