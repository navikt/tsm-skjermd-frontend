# TSM-Skjermd-Frontend Copilot Instructions

## Architecture Overview

**tsm-skjermd-frontend** is a React widget embedded in iframes inside Atlassian Jira (via a Forge app). It shows and edits sensitive case data (saker) that lives in the `tsm-skjermd` backend, keeping it out of Jira Cloud. It runs on NAV's NAIS/GCP infrastructure behind a Wonderwall sidecar.

**Key Components:**
- **server.js**: Express 5 BFF — serves the built SPA (`dist/`), proxies API calls to the `tsm-skjermd` backend, and runs the server-side OAuth (Authorization Code + PKCE) flow used by the embedded iframe.
- **src/auth/useEmbedAuth.ts**: The embed auth hook. Owns the `sid` session id, `openLogin()`, token polling, and `sessionStorage` token handling.
- **src/auth/msalConfig.ts** + **pages/AuthWindow.tsx** / **AuthCallback.tsx**: MSAL popup-window login (alternative/legacy path).
- **src/pages/SakIframe.tsx** & **SensureringIframe.tsx**: The two auth-gated embedded views.
- **src/api/sakApi.ts**: Backend client; uses an embed token provider for the Bearer token.

## Tech Stack

- React 19 + React Router 7, Vite 6, TypeScript
- NAV Aksel design system (`@navikt/ds-react`) + Tailwind CSS 3
- Express 5 server (`server.js`), `@azure/msal-browser`
- pnpm 10.5.2

## Build & Run

```bash
pnpm install        # Install
pnpm dev            # Vite dev server → http://localhost:3000
pnpm build          # tsc -b && vite build → dist/
pnpm lint           # ESLint
pnpm start          # node server.js (Express BFF + static serving)
```

Copy `.env.example` → `.env` for local server runs.

## Embed Auth Flow

The widget runs in a sandboxed Jira iframe, so login cannot render inline:

1. `useEmbedAuth` creates a `sid` and exposes `openLogin()`.
2. `openLogin()` tries `window.open('/embed/auth/start?sid=...')`. If the sandbox blocks the popup, it falls back to `window.parent.postMessage({ type: 'skjermd:open-login', url }, '*')` so the Forge host opens it via `router.open`.
3. `server.js` `/embed/auth/start` builds the Azure AD authorize URL with PKCE (S256) and redirects.
4. `/embed/auth/callback` exchanges the code server-side (using the client secret) and stores the token keyed by `sid`.
5. The widget polls `/embed/api/auth/poll?sid=...`, stores the token in `sessionStorage`, and sends it as a Bearer token to the backend.

**Never** try to load Microsoft's login page inside the iframe (it sets `X-Frame-Options: DENY`).

## Code Conventions

- **Norwegian UI**: All user-facing text is bokmål.
- **Aksel first**: Use Aksel primitives (`Box`, `HStack`, `VStack`, `BodyShort`, `Button`, `Alert`) and spacing tokens over raw CSS.
- **sessionStorage, not localStorage** for access tokens.
- **No hardcoded secrets/URLs**: use env vars / NAIS secrets via `envFrom`. The Forge/backend URL comes from `process.env`.
- **PII masking**: never log fødselsnummer or token contents; use `src/logger.ts`.
- **No code comments** unless explicitly requested.

## Common Pitfalls

1. **Wonderwall glob depth**: In `.nais/*.yaml`, `autoLoginIgnorePaths` glob `*` does NOT cross `/`. Every nested embed path (e.g. `/embed/api/saker/*/sensurering`, `.../filer`, `.../kommentarer`) must be listed explicitly, or Wonderwall returns 401 for that route.
2. **Popup blocked in iframe**: A left-click `window.open` is treated as a popup and may be blocked by the Jira iframe sandbox — rely on the `postMessage` → `router.open` fallback in `openLogin()`, and require `allow-popups allow-popups-to-escape-sandbox` on the Forge iframe.
3. **Token expiry**: `getAccessToken` throws when the token is expired; gate UI on `auth.status` and offer `openLogin` to recover.
4. **dev vs prod manifests**: `.nais/dev.yaml` and `.nais/nais.yaml` must stay in sync for `autoLoginIgnorePaths` and CORS/redirect URIs.

## Deployment

GitHub Actions in `.github/workflows/` deploy to NAIS:
- **dev-gcp**: `.nais/dev.yaml`
- **prod-gcp**: `.nais/nais.yaml`

Both run behind a Wonderwall sidecar (`autoLogin: true`).
