# Card-only follow-on candidate

This draft is stacked on PR21 (`42da5ed6e2184395aa129f9fe5113638366790f2`). It does not change the currently hosted multiplayer preview. Review it separately before deciding whether to update that preview.

## Preserved generator behavior

The inspected production source is `main` at `33dbb997d8dbaa69d29c78e5c092905f796e3c0d`, `src/components/map-card.tsx`. It is a key-card generator, not a local full-game UI. This candidate retains the default 5 × 5 color-key view, initial alternating placeholder, Randomize workflow, six 300 ms shuffle frames followed by a 500 ms settle, disabled/busy control during generation, starting-team markers, and counts of 9 starting-team agents, 8 other agents, 7 neutral cells and 1 black cell. Original role colors are retained. Reduced-motion users get an immediate result.

The surrounding UI keeps Remzilo branding. Localized labels and non-color symbols make the key readable in English and Hebrew. Grid positions stay physically left-to-right when Hebrew controls are RTL; this avoids mirroring the key relative to the word board. A word-card view uses the same 25-word deal and the existing independently curated bilingual vocabulary. Switching key/word views does not regenerate. Changing language clears the old deal. Reloading or leaving card-only mode discards the local deal, as with the original generator's reload behavior.

## Entry and isolation

- `/?mode=cards&lang=he` or `/?mode=cards&lang=en`: standalone generator.
- `/` (or `/?lang=en`): online room entry, with a visible generator control.
- `/?room=CODE`: authoritative online invitation/rejoin; a room parameter takes precedence over a stray card-mode flag.

No name, account, room, session token, storage or API is needed to generate a local card. After the app assets load, generation and switching modes work with the browser offline. This is not an installable/offline-cached app: a first load or offline reload still requires available assets. The local key is intentionally available to its device owner and is not an online operative-security boundary. It is independently generated and cannot reveal any online room's key. No local deal is serialized into URLs or submitted to the room API.

The vocabulary module moved unchanged from `server/words.mjs` to `src/data/words.mjs` so both generator and authority use one curated collection. Only public vocabulary is shared with the client; online key generation, credentials, room state, role projection and command authorization remain in the server engine. The Worker exporter follows the new vocabulary location.

## Verification and local review

```
npm run lint
npm run typecheck
npm run test:ci
npm run test:server
CI=true GENERATE_SOURCEMAP=false npm run build
node scripts/export_worker.mjs build /tmp/remzilo-card-worker
node scripts/preview_worker.mjs /tmp/remzilo-card-worker/index.mjs /tmp/remzilo-card-worker/qa.sqlite
GAME_URL=http://127.0.0.1:3002 python3 scripts/check_cards.py
GAME_URL=http://127.0.0.1:3002 python3 scripts/check_online.py
```

The card browser script covers English/Hebrew and 320, 360, 412 and 1280 px, with offline generation, role counts, unique words, repeated Randomize, mode navigation, zero room API calls, zero stored session, no overflow and no browser errors. The existing four-isolated-client script separately verifies that full online rooms still synchronize, protect keys, reconnect and transfer the host. CI runs both scripts against the exported Worker.

Local review evidence is in `/tmp/remzilo-card-evidence/`: `original-key-WIDTH.png` and `original-results.json` come from a local production-main build; `en-key-WIDTH.png`, `he-key-WIDTH.png`, word-view PNGs and `results.json` come from this candidate. Full-room evidence is in `/tmp/remzilo-card-online-evidence/`. These are local synthetic browser checks, not actual-phone or assistive-technology review. No screenshots or runtime databases were published.

## Production merge blocker

Do not merge into the current main deployment as-is. Main still deploys a static GitHub Pages client; the full online mode needs its approved Worker/database authority. This follow-on does not authorize changing production routing, replacing the existing domain, merging PR21, updating the live preview, changing Sites/DNS/credentials, or deploying anything. The parent review flow will decide preview updates after user feedback.
