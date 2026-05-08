# sparxstar-3iatlas-rlc-ui

React frontend for the SPARXSTAR 3iAtlas Rapid Language Collection game.

Calls the `sparxstar-3iatlas-rlc` WordPress plugin REST API at `/aiwa/v1/`.

## Stack

- React 19 + TypeScript
- Vite 6
- PWA — installs on mobile, works offline
- No WordPress dependency — talks to the plugin via REST

## Development

```bash
cp .env.example .env.local
# Set VITE_WP_URL to your WordPress dev site URL

npm install
npm run dev
```

The Vite dev server proxies `/aiwa/v1/` calls to your WordPress install.

## Build

```bash
npm run build
```

Output in `dist/`. Deploy to any static host or CDN.

## Architecture

```
sparxstar-3iatlas-rlc-ui   ← this repo (React UI)
    ↓ REST API calls to /aiwa/v1/
sparxstar-3iatlas-rlc      ← WordPress plugin (game server)
```

## Phase status

- [x] Phase 1 — Scaffold, types, API client, routing
- [x] Phase 2 — Session core: teacher setup, teacher monitor, student join, RWC collection
- [ ] Phase 4 — RSC collection (12 grammar domains)
- [ ] Phase 5 — QC phase (voting, corrections, translations)
- [ ] Phase 6 — Awards ceremony
- [ ] Phase 7 — PWA, offline queue, e2e test

## Confidential · Patent Pending · Starisian Technologies
