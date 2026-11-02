"""Local production-build regression checks; requires Playwright and Chromium.

Usage: python3 scripts/check_gameplay.py http://127.0.0.1:8000
"""
import sys
from playwright.sync_api import sync_playwright, expect


def check(page, base_url, width):
    page.set_viewport_size({'width': width, 'height': 850})
    page.goto(f'{base_url}/?game=TESTBOARD')
    team = page.locator('.turn-chip').inner_text().split()[0].lower()
    page.get_by_label('Clue word', exact=True).fill('Ocean')
    page.get_by_label('Clue count', exact=True).select_option('1')
    page.get_by_role('button', name='Start clue').click()
    badge = page.get_by_label('2 guesses remaining', exact=True)
    expect(badge).to_be_visible()
    expect(badge).to_have_attribute('aria-live', 'polite')
    bounds = badge.bounding_box()
    assert bounds['x'] >= 0 and bounds['x'] + bounds['width'] <= width
    page.locator(f'.word-card[data-role="{team}"]').first.click()
    expect(page.get_by_label('1 guesses remaining', exact=True)).to_be_visible()
    assert page.locator('.clue-badge').inner_text() == ('1 left' if width <= 600 else '1')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.locator(f'.word-card[data-role="{team}"]:not(:disabled)').first.click()
    expect(page.locator('.clue-badge')).to_have_count(0)
    for count in ['0', '∞']:
        page.get_by_label('Clue word', exact=True).fill('Ocean')
        page.get_by_label('Clue count', exact=True).select_option(count)
        page.get_by_role('button', name='Start clue').click()
        expect(page.get_by_label('unlimited guesses remaining')).to_be_visible()
        page.get_by_role('button', name='End turn').click()


if __name__ == '__main__':
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page()
        for width in [320, 375, 600, 601, 1280]:
            check(page, sys.argv[1].rstrip('/'), width)
            print(f'PASS countdown, bonus guess, zero/infinity, no overflow: {width}px')
        browser.close()
