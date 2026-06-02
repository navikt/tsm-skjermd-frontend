# AGENTS.md — tsm-skjermd-frontend

## Project Overview

**tsm-skjermd-frontend** is a React widget that runs embedded in iframes inside Atlassian Jira (via a Forge app). It displays and edits sensitive case data (saker) that is kept out of Jira Cloud, referencing the `tsm-skjermd` backend instead. Runs on NAV's NAIS/GCP infrastructure behind a Wonderwall sidecar.

## Tech Stack

- **Language**: TypeScript
- **UI**: React 19 + React Router 7
- **Build**: Vite 6
- **Design system**: NAV Aksel (`@navikt/ds-react`, `@navikt/ds-css`, `@navikt/aksel-icons`) + Tailwind CSS 3
- **Server / BFF**: Express 5 (`server.js`) — proxies to backend, serves the SPA, and runs server-side OAuth
- **Auth**: `@azure/msal-browser` (popup window) + server-side Authorization Code flow with PKCE for the embedded iframe
- **Package manager**: pnpm 10.5.2
- **Container**: Docker (multi-stage, distroless-style runtime via `node server.js`)

## Build & Run

```bash
pnpm install        # Install dependencies
pnpm dev            # Vite dev server on http://localhost:3000
pnpm build          # tsc -b && vite build → dist/
pnpm lint           # ESLint
pnpm start          # Run the Express server (node server.js) — serves dist/ + BFF/proxy
```

Copy `.env.example` to `.env` and fill in values before running the Express server locally.

## Project Structure

```
src/
├── App.tsx                  # Routing (react-router)
├── main.tsx                 # Entrypoint
├── layout.tsx               # Shared layout
├── index.css                # Tailwind + Aksel styles
├── embedHeightSync.ts       # Iframe auto-resize (postMessage to Jira host)
├── logger.ts                # createLogger() structured logging helper
├── api/
│   ├── sakApi.ts            # Backend API client + embed token provider
│   └── types.ts             # Shared domain types
├── auth/
│   ├── msalConfig.ts        # MSAL instance + login scopes
│   └── useEmbedAuth.ts      # Embed auth hook (server-side PKCE + polling)
├── components/              # FileList, FileUploadZone, SensureringEditor, Header, Footer
├── mocks/                   # setupMocks.ts (local dev mock data)
└── pages/
    ├── SakIframe.tsx          # Embedded sak view (auth-gated)
    ├── SensureringIframe.tsx  # Embedded sensurering editor (auth-gated)
    ├── AuthWindow.tsx         # MSAL popup-window login page
    ├── AuthCallback.tsx       # MSAL redirect handler
    ├── SakerList.tsx / SakDetail.tsx / NySak.tsx / RegistrerSak.tsx
server.js                    # Express BFF: static serving, backend proxy, server-side OAuth
.nais/                       # NAIS manifests (dev.yaml, nais.yaml) + Wonderwall config
```

## Embed Auth Flow (important)

The widget runs inside a sandboxed Jira iframe, which constrains how login works:

1. `useEmbedAuth` generates a session id (`sid`) and exposes `openLogin()`.
2. `openLogin()` calls `window.open('/embed/auth/start?sid=...')`. If the sandbox blocks the popup (`window.open` returns `null`), it falls back to `window.parent.postMessage({ type: 'skjermd:open-login', url })` so the Forge host can open it via `router.open`.
3. `server.js` `/embed/auth/start` builds the Azure AD authorize URL with PKCE (S256) and redirects.
4. `/embed/auth/callback` exchanges the code for a token (server-side, using the client secret) and stores it keyed by `sid`.
5. The widget polls `/embed/api/auth/poll?sid=...`; once authenticated it stores the access token in `sessionStorage` and uses it as a Bearer token for backend calls.

Microsoft's login page cannot render in an iframe, so login must happen in a separate tab/window — never try to load it inside the iframe.

## Key Conventions

- **Language**: UI text and user-facing strings are in Norwegian (bokmål).
- **Design system**: Prefer Aksel primitives (`Box`, `HStack`, `VStack`, `BodyShort`, `Button`, `Alert`) and Aksel spacing tokens over raw CSS where practical.
- **Tokens in sessionStorage, not localStorage**: access tokens are short-lived and stored in `sessionStorage` only.
- **No secrets in client code or git**: backend/Forge URLs and secrets come from env vars / NAIS secrets (`envFrom`), never hardcoded.
- **PII**: never log fødselsnummer or token contents; use `logger.ts` helpers.
- **Wonderwall `autoLoginIgnorePaths`**: glob `*` does NOT cross `/`, so every nested `/embed/api/saker/*/...` path must be listed explicitly in `.nais/*.yaml`.
- **No code comments** unless explicitly requested.

## Deployment

GitHub Actions in `.github/workflows/` deploy to NAIS:
- **dev-gcp**: `.nais/dev.yaml`
- **prod-gcp**: `.nais/nais.yaml`

Both run behind a Wonderwall sidecar (`autoLogin: true`) with `autoLoginIgnorePaths` covering the `/embed/**` routes used by the Jira iframe.
