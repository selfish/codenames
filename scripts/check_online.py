"""Four isolated phone browsers against the real Node authority; no mocked state."""
import json
import os
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get('GAME_URL', 'http://127.0.0.1:3001')
OUT = Path(os.environ.get('EVIDENCE_DIR', '/tmp/remzilo-evidence'))
OUT.mkdir(parents=True, exist_ok=True)


def api(page, action=None):
    return page.evaluate('''async action => {
      const code = new URL(location.href).searchParams.get('room');
      const token = localStorage.getItem('room:' + code);
      const headers = {Authorization: 'Bearer ' + token};
      const state = (await (await fetch('/api/rooms/' + code, {headers})).json()).state;
      if (!action) return state;
      const response = await fetch('/api/rooms/' + code + '/action', {
        method:'POST', headers:{...headers, 'Content-Type':'application/json'},
        body:JSON.stringify({...action, version: action.version ?? state.version})
      });
      return {status:response.status, ...await response.json()};
    }''', action)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None), args=['--no-sandbox'])
    evidence = []
    for language in ['en', 'he']:
        contexts = [browser.new_context(viewport={'width': w, 'height': 844}, is_mobile=True, has_touch=True) for w in [320, 360, 390, 412]]
        pages = [c.new_page() for c in contexts]
        errors = []
        for page in pages:
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(BASE)
            page.get_by_label('Language / שפה').select_option(language)
        name = 'Your name' if language == 'en' else 'השם שלך'
        create = 'Create room' if language == 'en' else 'יצירת חדר'
        join = 'Join room' if language == 'en' else 'הצטרפות לחדר'
        pages[0].get_by_label(name).fill('Guide Red')
        pages[0].get_by_role('button', name=create, exact=True).click()
        pages[0].wait_for_url('**?room=*')
        code = api(pages[0])['code']
        for i in range(1,4):
            pages[i].get_by_label(name).fill(['', 'Finder Red', 'Guide Blue', 'Finder Blue'][i])
            pages[i].get_by_label('Room code' if language == 'en' else 'קוד חדר').fill(code)
            pages[i].get_by_role('button', name=join, exact=True).click()
            pages[i].wait_for_url('**?room=*')
        for i,page in enumerate(pages):
            # Seat through the visible lobby after all four join responses have arrived.
            page.wait_for_timeout(1200)
            team = '.team-red' if i < 2 else '.team-blue'
            role = ('Clue guide' if language == 'en' else 'מדריך/ת רמזים') if i % 2 == 0 else ('Finder' if language == 'en' else 'מנחש/ת')
            page.locator(team).get_by_role('button', name=role, exact=True).click()
            page.locator(team).get_by_role('button', name=role, exact=True).wait_for()
            page.wait_for_function("document.querySelector('button[aria-pressed=true]') !== null")
        start = pages[0].get_by_role('button', name='Start game' if language == 'en' else 'התחלת משחק', exact=True)
        start.click()
        for page in pages:
            page.locator('.online-card').first.wait_for()
        states = [api(page) for page in pages]
        assert len({json.dumps(s['cards'], ensure_ascii=False) for s in [states[1], states[3]]}) == 1
        for i in [1,3]:
            assert all('role' not in card for card in states[i]['cards'])
            assert not pages[i].locator('.online-card.red, .online-card.blue, .online-card.assassin').count()
        spy = 0 if states[0]['turn'] == 'red' else 2
        finder = spy+1
        clue_label = 'Clue' if language == 'en' else 'רמז'
        pages[spy].get_by_label(clue_label, exact=True).fill('connections' if language == 'en' else 'קשרים')
        pages[spy].get_by_label('Count' if language == 'en' else 'מספר', exact=True).select_option('2')
        pages[spy].get_by_role('button', name='Give clue' if language == 'en' else 'שליחת רמז', exact=True).click()
        pages[finder].locator('.online-card:not([disabled])').first.wait_for()
        key = api(pages[spy])
        correct = next(i for i,c in enumerate(key['cards']) if c['role'] == key['turn'])
        pages[finder].locator('.online-card').nth(correct).click()
        for page in pages:
            page.locator('.online-card.revealed').wait_for()
        pages[finder].reload()
        pages[finder].locator('.online-card.revealed').wait_for()
        assert len([c for c in api(pages[finder])['cards'] if c['revealed']]) == 1
        contexts[finder].set_offline(True)
        pages[finder].get_by_role('status').filter(has_text='Reconnecting' if language == 'en' else 'מתחברים מחדש').wait_for(timeout=15000)
        assert pages[finder].locator('.online-card:not([disabled])').count() == 0
        contexts[finder].set_offline(False)
        pages[finder].locator('.online-card:not([disabled])').first.wait_for(timeout=15000)
        for i, page in enumerate(pages):
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (language, i)
            assert page.locator('main').get_attribute('dir') == ('rtl' if language == 'he' else 'ltr')
            page.screenshot(path=str(OUT / f'{language}-{i}.png'), full_page=True)
        # Host departure while the other three contexts remain live.
        contexts[0].set_offline(True)
        deadline = time.monotonic() + 45
        old_host = states[0]['me']
        while time.monotonic() < deadline:
            host_id = api(pages[1])['host']
            if host_id != old_host:
                break
            pages[1].wait_for_timeout(1000)
        assert host_id != old_host, 'Host did not transfer within 45s'
        new_host = next(i for i in [1,2,3] if api(pages[i])['me'] == host_id)
        assert api(pages[new_host], {'type':'new'})['status'] == 200
        for page in pages[1:]:
            page.locator('.lobby').wait_for()
        assert not errors, errors
        evidence.append({'language':language,'isolated_clients':4,'widths':[320,360,390,412], 'key_private':True,'shared_reveal':True,'reload':True,'offline_reconnect':True,'host_failover':True,'new_lobby':True,'overflow':False,'page_errors':errors})
        for context in contexts:
            context.close()
    browser.close()
    (OUT / 'results.json').write_text(json.dumps(evidence, indent=2) + '\n')
    print(json.dumps(evidence, indent=2))
