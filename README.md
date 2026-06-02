# tsm-skjermd-frontend

React-widget som kjører innebygd i iframes inne i Atlassian Jira (via en Forge-app). Viser og redigerer sensitive saksdata (saker) som holdes utenfor Jira Cloud, og refererer i stedet til `tsm-skjermd`-backenden. Kjører på NAVs NAIS/GCP-infrastruktur bak en Wonderwall-sidecar.

## 🚀 Teknologi

- [React 19](https://react.dev/) + [React Router 7](https://reactrouter.com/)
- [Vite 6](https://vitejs.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [@navikt/ds-react (Aksel)](https://aksel.nav.no/) + [Tailwind CSS 3](https://tailwindcss.com/)
- [Express 5](https://expressjs.com/) (BFF/proxy + server-side OAuth)
- [@azure/msal-browser](https://github.com/AzureAD/microsoft-authentication-library-for-js)
- [Docker](https://www.docker.com/)
- Pakkehåndterer: [pnpm](https://pnpm.io/) 10.5.2

## 📦 Installasjon

```bash
pnpm install
```

## 🧪 Lokal utvikling

```bash
pnpm dev
```

Appen starter på [http://localhost:3000](http://localhost:3000)

Kopier `.env.example` til `.env` og fyll inn verdier før du kjører Express-serveren lokalt.

### Tilgjengelige scripts

```bash
pnpm dev      # Vite dev-server på http://localhost:3000
pnpm build    # tsc -b && vite build → dist/
pnpm lint     # ESLint
pnpm start    # node server.js (Express BFF + statisk servering av dist/)
```

## 🐳 Bygg og kjør med Docker

Bygg:

```bash
docker build -t tsm-skjermd-frontend .
```

Kjør lokalt:

```bash
docker run -p 3000:3000 tsm-skjermd-frontend
```

Appen er da tilgjengelig på [http://localhost:3000](http://localhost:3000)

## 🔐 Innloggingsflyt (embed)

Widgeten kjører i en sandboxet Jira-iframe, så innlogging kan ikke vises inline (Microsofts login-side setter `X-Frame-Options: DENY`):

1. `useEmbedAuth` lager en `sid` og eksponerer `openLogin()`.
2. `openLogin()` prøver `window.open('/embed/auth/start?sid=...')`. Hvis sandboxen blokkerer popup-en, faller den tilbake til `window.parent.postMessage({ type: 'skjermd:open-login', url })` slik at Forge-verten kan åpne den via `router.open`.
3. `server.js` `/embed/auth/start` bygger Azure AD-authorize-URL med PKCE (S256) og redirecter.
4. `/embed/auth/callback` bytter koden mot et token server-side (med client secret) og lagrer det på `sid`.
5. Widgeten poller `/embed/api/auth/poll?sid=...`, lagrer access-tokenet i `sessionStorage` og bruker det som Bearer-token mot backenden.

## 📁 Filstruktur

```
src/
├── App.tsx                  # Routing (react-router)
├── main.tsx                 # Entrypoint
├── layout.tsx               # Delt layout
├── index.css                # Tailwind + Aksel-styles
├── embedHeightSync.ts       # Iframe auto-resize (postMessage til Jira-host)
├── logger.ts                # createLogger() strukturert logging
├── api/                     # sakApi.ts (backend-klient) + types.ts
├── auth/                    # msalConfig.ts + useEmbedAuth.ts
├── components/              # FileList, FileUploadZone, SensureringEditor, Header, Footer
├── mocks/                   # setupMocks.ts (mockdata for lokal utvikling)
└── pages/                   # SakIframe, SensureringIframe, AuthWindow, AuthCallback, m.fl.
server.js                    # Express BFF: statisk servering, backend-proxy, server-side OAuth
.nais/                       # NAIS-manifester (dev.yaml, nais.yaml) + Wonderwall-config
```

## 🤖 AI-agenter

Repoet inneholder agent-instruksjoner som lastes automatisk av AI-verktøy:

- [`AGENTS.md`](AGENTS.md) — åpen standard (Copilot, Cursor, Claude Code m.fl.)
- [`.github/copilot-instructions.md`](.github/copilot-instructions.md) — GitHub Copilot-spesifikk

## 🔐 NAV-pakker

Hvis du bruker NAV sine GitHub-publiserte pakker:

- Du må legge til en `NODE_AUTH_TOKEN` som secret ved bygg
- Dette er allerede støttet i Dockerfile via `--mount=type=secret`

## 🚢 Deploy

GitHub Actions i `.github/workflows/` deployer til NAIS:

- **dev-gcp**: `.nais/dev.yaml`
- **prod-gcp**: `.nais/nais.yaml`

Begge kjører bak en Wonderwall-sidecar (`autoLogin: true`) med `autoLoginIgnorePaths` som dekker `/embed/**`-rutene som Jira-iframen bruker.
