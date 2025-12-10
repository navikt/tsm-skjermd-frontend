import type { Sak, OpprettSakRequest, EndreSakRequest } from "./types";

const API_BASE = "/api/v1";

const isLocalDev = window.location.hostname === "localhost";

// Token management for local dev
let localDevToken: string | null = null;
let tokenPromise: Promise<string> | null = null;

async function getLocalDevToken(): Promise<string> {
  if (localDevToken) return localDevToken;
  if (tokenPromise) return tokenPromise;

  tokenPromise = fetch("http://localhost:8081/azure/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&client_id=local-client-id&client_secret=local-secret",
  })
    .then((res) => res.json())
    .then((data) => {
      localDevToken = data.access_token;
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

  // Add Authorization header for local dev
  if (isLocalDev) {
    const token = await getLocalDevToken();
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const fullUrl = `${API_BASE}${path}`;
  console.log(`[API] ${options.method || "GET"} ${fullUrl}`);

  const res = await fetch(fullUrl, {
    ...options,
    credentials: "include",
    headers,
  });

  console.log(`[API] Response: ${res.status} ${res.statusText}`);

  if (res.status === 401) {
    if (isLocalDev) {
      // Reset token and retry once
      localDevToken = null;
      tokenPromise = null;
      throw new Error("Token ugyldig - prøv igjen");
    }
    // Forhindre redirect-loop
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
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

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
};
