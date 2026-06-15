# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

- `npm run dev` — Start Vite dev server (proxies `/sf-oauth` to Salesforce login for PKCE OAuth)
- `npm run build` — Production build to `dist/`
- `npm run lint` — ESLint (flat config, ESLint 9+)
- `npm run preview` — Preview production build locally

## Architecture

React 19 SPA built with Vite 8, using React Router DOM for client-side routing. Pure CSS styling (no framework), dark theme default. ES modules throughout (`"type": "module"`).

### Routing

- `/` → `Home.jsx` — Portfolio homepage (hero + footer)
- `/BankerPOC` → `BankerPOC.jsx` — Salesforce opportunity management dashboard

### Salesforce Integration (`src/utils/`)

- **auth.js** — Browser-side PKCE OAuth flow against Salesforce. Tokens stored in `sessionStorage`. The Vite dev server proxies `/sf-oauth` → `https://login.salesforce.com/services/oauth2` to avoid CORS issues.
- **salesforce.js** — REST API calls (API v59.0) to query/update opportunities. Uses a hardcoded banker user ID for opportunity filtering.

### Environment Variables

Prefixed with `VITE_` (exposed to client via Vite):
- `VITE_SF_CLIENT_ID` — Salesforce OAuth client ID
- `VITE_SF_LOGIN_URL` — Salesforce login endpoint

### Deployment

GitHub Actions (`.github/workflows/deploy.yml`): pushes to `main` trigger build → lint → rsync to remote server (`~/public_html/mcguffin.dev/`). Uses secrets: `SSH_KEY`, `SSH_USER`, `SSH_HOST`.
