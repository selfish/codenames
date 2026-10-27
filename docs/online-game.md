# Online game candidate — architecture checkpoint

Working title: Remzilo / רמזילו. Naming clearance is pending; no repository, domain or external identity has been changed. Bounded naming research found no clearly matching game, but this is not trademark clearance. New UI copy and the server's garden/workshop/neighborhood/arts vocabulary were independently assembled for this candidate. No official art or rulebook text is used. PR12's prior component remains in source with its historical regression tests and the new original vocabulary, but is not imported into the online application.

## Inspected baseline

- Main: 33dbb99, including merged maintenance PR17.
- This branch descends from PR12 a1c6fbb, preserving that work and its tests.
- PR14 (metadata) and PR18 (router removal) remain separate, open candidates.
- No AGENTS.md or repository skill files were present in the checkout or workspace `.agents` directory.
- Existing application/hosting was entirely static. PR12 generates a deterministic key in the browser; it is a shared-board prototype, not multiplayer authority.
- Current preview workflow permits only PR14/eb34cc1 and PR18/e95be1c. It does not authorize this candidate. No preview gates, Pages content, production workflow, existing PR branches or deployments have been changed. New candidate branding necessarily replaces its document metadata; PR14 remains intact on its own branch.

## Minimal architecture

One Node process serves the React production build and same-origin JSON API. No runtime npm packages, database, accounts, analytics, CORS allowlist, browser-generated key or third-party game service. Each room owns a cryptographically shuffled key and monotonically increasing revision. Authenticated clients poll every second; requests carry an opaque 256-bit player token in Authorization. The room link contains only its join code. Tokens are held in browser storage for reload recovery; no game state is taken from storage.

The lobby permits role selection before any key exists. Starting requires an online operative and spymaster on each team. Roles then lock; late arrivals spectate until the next lobby. Every state response projects cards for that authenticated role: unrevealed roles are omitted for operatives/spectators. Only the active team's spymaster can submit a clue; only its operatives can guess/end a guessing turn. Atomic synchronous commands require the current revision, so concurrent duplicate/stale requests cannot apply twice. No automatic command retries.

A correct guess spends one allowance; a numbered clue grants count+1, 0/∞ are unlimited; a neutral/opponent card ends the turn, the blackout loses immediately, and completing either team's cards wins for that team. The host may confirm abandoning a game and start a fresh lobby; no old key survives in the new lobby, and the next deal is independent. Host leave transfers control immediately; host absence transfers control after 30 seconds to a connected player. Active gameplay does not depend on the host's phone.

## Run and preview boundary

```
npm ci
npm run test:server
npm run test:ci
npm run build
npm run serve
```

Open http://127.0.0.1:3001. `HOST=0.0.0.0 PORT=3001 npm run serve` permits testing from phones on an approved private LAN using that computer's LAN IP. For a public phone-accessible preview, approve a specific existing Node-capable host and valid HTTPS reverse-proxy route to this single process, with one replica and no caching of `/api`. Static GitHub Pages cannot run the authority. No account creation, paid service, credentials, grants or infrastructure changes were attempted. Do not publish a static build and describe it as a multiplayer preview.

## Limits before production

Rooms live in process memory, expire after six idle hours, and disappear on restart. One process/replica only. Up to 200 rooms and 24 participants per room; no persistent identity or cross-device recovery. Tokens grant access to their role, so protect browser storage and use HTTPS outside a trusted LAN. A room code is an invitation, not identity verification; people with the link can take lobby seats. The server enforces roles, but cannot prevent a human spymaster sharing their key or joining with a second identity. There is a coarse per-source-IP request limit; production abuse controls and durable storage are future work. The inherited CRA dependency baseline has known advisories and is not production security clearance.

No merge or production rollout is authorized. A hosted preview, actual-phone review, candidate-name review and separate merge approval remain required.

## Persistent Worker adapter (implemented)

`server/game.mjs` uses standard Web Crypto and a plain ESM vocabulary import, with no Node-specific imports. The same engine runs in the Node transport and `server/worker.mjs`. The Worker accepts a D1-compatible `DB` binding and stores rooms, player credentials and hidden cards only in trusted SQL storage. Browser state remains role-filtered.

`server/migrations/0001_rooms.sql` creates rooms; `0002_request_limits.sql` adds request quotas; `0003_request_limit_maintenance.sql` adds the singleton cleanup claim. All three are schema-only migrations. Apply it via the approved host's migration workflow, never in a request handler. Each room row has an internal storage revision separate from the public game revision. Every mutation (including heartbeat/host transfer) performs a conditional `UPDATE ... WHERE revision = ?`; failed comparisons re-read and revalidate. A competing move invalidates the original action version, preventing duplicate execution. No isolate-local room map is authoritative in this adapter. Rooms survive process/isolate replacement and expire after six idle hours. The 200-room/24-player limits remain. Both transports bound requests to 3,600/minute per source, with additional 10/minute create and 60/minute join limits. Worker quotas use atomic SQL upserts and hashed edge-provided addresses; raw addresses are not stored. Any same-origin API request, including malformed/unauthorized requests, can trigger quota expiry cleanup. A singleton SQL claim allows one sweep per minute; the indexed sweep deletes at most 1,000 oldest expired rows, so it never scans/deletes the entire quota table on each request. Heavy distributed abuse can leave a cleanup backlog and remains an operational monitoring concern. Non-Cloudflare deployments must supply a trusted source-address adapter rather than accepting visitor-provided CF-Connecting-IP headers. Production operating costs, distributed abuse and monitoring still need review.

```
npm run build
node scripts/export_worker.mjs build /tmp/remzilo-worker
node scripts/preview_worker.mjs /tmp/remzilo-worker/index.mjs /tmp/remzilo-worker/preview.sqlite
GAME_URL=http://127.0.0.1:3002 python3 scripts/check_online.py
```

The exporter embeds this candidate's build assets and engine in a standalone Worker ESM module, plus separate schema SQL files. It does not create any service, credentials, database or hostname. The local preview adapter uses Python's SQLite and Node solely to exercise the Worker contract. It is test tooling, not a cloud runtime dependency.

Sites reference instructions are accessible, including Worker ESM and D1. No Sites helper installation was found in this execution environment; the hosting owner must package the exported Worker using the supported helper/manifest and migration conventions. No Site identity/manifest has been invented. The user's custom-domain condition must be met before any publication; proposed hosting is not authorization for DNS edits.

Do not merge directly into the current main deployment: its Pages workflow would publish a client without its required authority. The approved hosting topology and deployment routing must be settled before merge.
