import type { Sak, OpprettSakRequest, EndreSakRequest, UserInfo, Tilgang, GiTilgangRequest, LagreSensureringRequest, LagreSensureringResponse } from "./types";
import { createLogger } from "../logger";
import { isIframeMode, getIframeToken } from "./iframeAuth";

const log = createLogger("API");
const authLog = createLogger("Auth");

const API_BASE = "/internal/v1";
const EMBED_API_BASE = "/embed/api";

const isLocalDev = window.location.hostname === "localhost";

// Token management for local dev
let localDevToken: string | null = null;
let tokenPromise: Promise<string> | null = null;

async function getLocalDevToken(): Promise<string> {
  if (localDevToken) return localDevToken;
  if (tokenPromise) return tokenPromise;

  log.debug("Henter lokal dev-token...");
  tokenPromise = fetch("http://localhost:8081/azure/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&client_id=local-client-id&client_secret=local-secret",
  })
    .then((res) => res.json())
    .then((data) => {
      localDevToken = data.access_token;
      log.debug("Lokal dev-token hentet");
      return localDevToken!;
    });

  return tokenPromise;
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (isIframeMode()) {
    const token = getIframeToken();
    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }
  } else if (isLocalDev) {
    const token = await getLocalDevToken();
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const method = options.method || "GET";
  const base = isIframeMode() ? EMBED_API_BASE : API_BASE;
  const fullUrl = `${base}${path}`;
  const start = performance.now();

  log.info(`${method} ${path}`);

  let res: Response;
  try {
    res = await fetch(fullUrl, {
      ...options,
      credentials: "include",
      headers,
    });
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    log.error(`${method} ${path} nettverksfeil (${duration}ms)`, err);
    throw err;
  }

  const duration = Math.round(performance.now() - start);

  if (res.status === 401) {
    log.warn(`${method} ${path} → 401 Unauthorized (${duration}ms)`);
    if (isIframeMode()) {
      throw new Error("Ikke autentisert - token mangler eller er utløpt");
    }
    if (isLocalDev) {
      localDevToken = null;
      tokenPromise = null;
      throw new Error("Token ugyldig - prøv igjen");
    }
    const lastRedirect = sessionStorage.getItem("lastLoginRedirect");
    const now = Date.now();
    if (lastRedirect && now - parseInt(lastRedirect) < 5000) {
      throw new Error("Autentiseringsfeil - kunne ikke logge inn");
    }
    sessionStorage.setItem("lastLoginRedirect", now.toString());
    window.location.href = "/oauth2/login";
    throw new Error("Ikke autentisert - omdirigerer til innlogging");
  }

  if (!res.ok) {
    log.error(`${method} ${path} → ${res.status} ${res.statusText} (${duration}ms)`);
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  log.info(`${method} ${path} → ${res.status} (${duration}ms)`);

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

export const sakApi = {
  hentAlle: (): Promise<Sak[]> => apiRequest("/saker"),

  hentPaId: (id: string): Promise<Sak> => apiRequest(`/saker/${id}`),

  hentPaJiraKey: (jiraIssueKey: string): Promise<Sak> =>
    apiRequest(`/saker/jira/${jiraIssueKey}`),

  opprett: (sak: OpprettSakRequest): Promise<Sak> =>
    apiRequest("/saker", {
      method: "POST",
      body: JSON.stringify(sak),
    }),

  endre: (id: string, sak: EndreSakRequest): Promise<Sak> =>
    apiRequest(`/saker/${id}`, {
      method: "PUT",
      body: JSON.stringify(sak),
    }),

  slett: (id: string): Promise<void> =>
    apiRequest(`/saker/${id}`, {
      method: "DELETE",
    }),

  giTilgang: (sakId: string, request: GiTilgangRequest): Promise<Tilgang> =>
    apiRequest(`/saker/${sakId}/tilganger`, {
      method: "POST",
      body: JSON.stringify(request),
    }),

  fjernTilgang: (sakId: string, navIdent: string): Promise<void> =>
    apiRequest(`/saker/${sakId}/tilganger/${navIdent}`, {
      method: "DELETE",
    }),
};

export const sensureringApi = {
  hent: (sakId: string): Promise<LagreSensureringResponse> =>
    apiRequest(`/saker/${sakId}/sensurering`),

  lagre: (sakId: string, request: LagreSensureringRequest): Promise<LagreSensureringResponse> =>
    apiRequest(`/saker/${sakId}/sensurering`, {
      method: "POST",
      body: JSON.stringify(request),
    }),
};

export const userApi = {
  hentBruker: async (): Promise<UserInfo> => {
    authLog.info("Henter brukerinfo...");
    const res = await fetch("/api/me", {
      credentials: "include",
    });

    if (!res.ok) {
      authLog.error(`Kunne ikke hente brukerinfo: ${res.status}`);
      throw new Error(`Failed to fetch user info: ${res.status}`);
    }

    authLog.info("Brukerinfo hentet");
    return res.json();
  },
};
