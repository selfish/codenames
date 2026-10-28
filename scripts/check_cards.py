"""Browser checks for standalone generation, offline use and mode isolation."""
import json
import os
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get('GAME_URL', 'http://127.0.0.1:3002')
OUT = Path(os.environ.get('CARD_EVIDENCE_DIR', '/tmp/remzilo-card-evidence'))
OUT.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('google-chrome') or shutil.which('chromium'), args=['--no-sandbox'])
    evidence = []
    for language in ['en', 'he']:
        for width in [320, 360, 412, 1280]:
            context = browser.new_context(viewport={'width': width, 'height': 900}, reduced_motion='reduce' if width != 320 else 'no-preference')
            page = context.new_page()
            errors, api_calls = [], []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('request', lambda r: api_calls.append(r.url) if '/api/' in r.url else None)
            page.goto(f'{BASE}/?mode=cards&lang={language}')
            page.locator('.generator-cell').nth(24).wait_for()
            assert page.get_by_role('main').get_attribute('dir') == ('rtl' if language == 'he' else 'ltr')
            # Assets have loaded; all generation and mode navigation must work offline.
            context.set_offline(True)
            randomize = 'Randomize' if language == 'en' else 'ערבוב מחדש'
            button = page.get_by_role('button', name=randomize, exact=True)
            button.click()
            button.wait_for()
            page.locator('.generator-cell[data-role]').nth(24).wait_for()
            roles = page.locator('.generator-cell').evaluate_all('(cells) => cells.map(c => c.dataset.role)')
            assert sorted([roles.count('red'), roles.count('blue')]) == [8,9]
            assert roles.count('neutral') == 7 and roles.count('black') == 1
            assert page.locator('.starting-marker').count() == 4
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.screenshot(path=str(OUT / f'{language}-key-{width}.png'), full_page=True)
            page.get_by_role('button', name='Word cards' if language == 'en' else 'כרטיסי מילים', exact=True).click()
            words = page.locator('.generator-cell').all_text_contents()
            assert len(set(words)) == 25
            assert not page.locator('.generator-cell[data-role]').count()
            if language == 'he':
                assert all(any('\u05d0' <= c <= '\u05ea' for c in word) for word in words)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.screenshot(path=str(OUT / f'{language}-words-{width}.png'), full_page=True)
            button.click()
            page.locator('.generator-grid[aria-busy=false]').wait_for()
            assert page.locator('.generator-cell').all_text_contents() != words
            page.get_by_role('button', name='Online rooms' if language == 'en' else 'משחק אונליין', exact=True).click()
            page.get_by_label('Your name' if language == 'en' else 'השם שלך', exact=True).wait_for()
            page.get_by_role('button', name='Card generator — no room needed' if language == 'en' else 'מחולל כרטיסים — ללא חדר', exact=True).click()
            page.get_by_role('button', name=randomize, exact=True).wait_for()
            assert not api_calls, api_calls
            assert page.evaluate('localStorage.length') == 0
            assert not errors, errors
            evidence.append({'language': language, 'width': width, 'offline_generation': True, 'key_counts': '9/8/7/1', 'unique_words': 25, 'repeated_randomize': True, 'mode_navigation': True, 'api_calls': 0, 'overflow': False, 'page_errors': errors})
            context.close()
    browser.close()
(OUT / 'results.json').write_text(json.dumps(evidence, indent=2) + '\n')
print(json.dumps(evidence, indent=2))
