# Remzilo / רמזילו — online candidate

A Hebrew and English team word game for four or more phones. Working name pending review; repository and domain names are unchanged.

This branch continues the interactive-board work in PR12 with authoritative rooms, private guide views, synchronized turns and reconnect recovery. It includes a runnable single-process local server and a persistent Worker/SQL adapter, not a production deployment.

The default local server stores rooms in memory; the Worker adapter persists them with revision-checked SQL updates.

See [architecture, run instructions, hosting approval boundary and limitations](docs/online-game.md).

```sh
npm ci
npm run build
npm run serve
```

Open http://127.0.0.1:3001, create a room, and share its link. Two teams each need a clue guide and a finder. Static hosting alone cannot run this game.

```sh
npm run lint
npm run typecheck
npm run test:ci
npm run test:server
# With the Node server running and Python Playwright + Chromium installed:
python3 scripts/check_online.py
```

No merge, public preview publication or production rollout has been approved for this candidate.
