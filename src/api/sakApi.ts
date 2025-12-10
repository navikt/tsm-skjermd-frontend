import type { Sak, OpprettSakRequest, EndreSakRequest } from "./types";

const API_BASE = "/api/v1";

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 401) {
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
