# Jira Secret Display

Dette prosjektet er en React-basert nettside for å brukes ved siden av Jira. Hensikten er å legge sensitive data utenfor JiraCloud, og kun referer til vår egen løsning. Prosjektet er bygget med Vite, Tailwind CSS og NAVs Aksel-designsystem.

## 🚀 Teknologi

- [React](https://reactjs.org/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [@navikt/ds-react](https://aksel.nav.no/)
- [Docker](https://www.docker.com/)

## 📦 Installasjon

```bash
npm install
```

## 🧪 Lokal utvikling

```bash
npm run dev
```

Appen starter på [http://localhost:3000](http://localhost:3000)

## 🐳 Bygg og kjør med Docker

Bygg:

```bash
docker build -t tsm-skjermd-frontend .
```

Kjør lokalt:

```bash
docker run -p 3000:80 tsm-skjermd-frontend
```

Appen er da tilgjengelig på [http://localhost:3000](http://localhost:3000)

### Iframe / widget

Denne repoen bygger også en egen `iframe`-versjon som kan embeddes i andre sider.

- Bygget prod-pakken vil inneholde `iframe.html` i `dist/`.
- Du kan åpne iframe direkte med hash-router:

	- Lokal fil: `file:///.../tsm-skjermd-frontend/iframe.html#/saker/<ID>`
	- Deployed: `https://ditt-domene/iframe.html#/saker/<ID>`

Eksempel på hvordan du embedder i en ekstern side:

```html
<iframe
	src="https://ditt-domene/iframe.html#/saker/SAK-123"
	width="100%"
	height="600"
	style="border:0"
	title="Sak-iframe"
></iframe>
```

## 📁 Filstruktur

```
src/
├── pages/               # Widget pages
│   └── tbd.tsx
│   └── tbd.tsx
├── hooks/               # Custom React hooks
├── App.tsx              # Routing
├── main.tsx             # Entrypoint
├── index.css            # Tailwind + Aksel styles
public/
Dockerfile
```

## 🔐 NAV-pakker (valgfritt)

Hvis du bruker NAV sine GitHub-publiserte pakker:

- Du må legge til en `NODE_AUTH_TOKEN` som secret ved bygg
- Dette er allerede støttet i Dockerfile via `--mount=type=secret`
