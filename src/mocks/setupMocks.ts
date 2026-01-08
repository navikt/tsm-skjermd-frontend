// Development fetch mocks for local dev environment
const originalFetch = window.fetch.bind(window as any);

type Sak = any;

const now = () => new Date().toISOString();

const mockSaker: Sak[] = [
  {
    id: "SAK-1",
    opprettetAv: "Z123456",
    opprettetTidspunkt: now(),
    endretAv: null,
    endretTidspunkt: null,
    sensitivData: "Dette er sensitiv informasjon for SAK-1",
    tilganger: [
      { navIdent: "Z123456", gittAv: "Z123456", gittTidspunkt: now() },
    ],
    jiraIssueKey: null,
  },
  {
    id: "SAK-2",
    opprettetAv: "Z999999",
    opprettetTidspunkt: now(),
    endretAv: null,
    endretTidspunkt: null,
    sensitivData: "Dummy data for SAK-2",
    tilganger: [],
    jiraIssueKey: "PROJ-123",
  },
];

let nextId = 3;

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function mockFetch(input: RequestInfo, init?: RequestInit) {
  const url = typeof input === "string" ? input : input.url;
  const method = (init && init.method) || "GET";

  // small delay to simulate network
  await new Promise((r) => setTimeout(r, 80));

  try {
    // Token endpoint used by local dev token fetch
    if (url.includes("/azure/token")) {
      return jsonResponse({ access_token: "local-dev-token" });
    }

    // /api/me
    if (url.endsWith("/api/me")) {
      return jsonResponse({ navIdent: "Z123456", displayName: "Test Bruker" });
    }

    // API v1 saker
    if (url.startsWith("/api/v1/saker") || url.includes("/api/v1/saker")) {
      const path = url.replace(/^https?:\/\/[^/]+/, "");
      const parts = path.split("/").filter(Boolean); // ['api','v1','saker', ...]

      // GET /api/v1/saker
      if (method === "GET" && parts.length === 3) {
        return jsonResponse(mockSaker);
      }

      // POST /api/v1/saker
      if (method === "POST" && parts.length === 3) {
        const body = init && init.body ? JSON.parse(init.body as string) : {};
        const newSak = {
          id: `SAK-${nextId++}`,
          opprettetAv: "Z123456",
          opprettetTidspunkt: now(),
          endretAv: null,
          endretTidspunkt: null,
          sensitivData: body.sensitivData || "",
          tilganger: [{ navIdent: "Z123456", gittAv: "Z123456", gittTidspunkt: now() }],
          jiraIssueKey: body.jiraIssueKey || null,
        };
        mockSaker.push(newSak);
        return jsonResponse(newSak, 201);
      }

      // operations on /api/v1/saker/:id
      if (parts.length >= 4) {
        const id = parts[3];
        const sakIndex = mockSaker.findIndex((s) => s.id === id);
        if (sakIndex === -1) return new Response(null, { status: 404 });

        // GET /api/v1/saker/:id
        if (method === "GET" && parts.length === 4) {
          return jsonResponse(mockSaker[sakIndex]);
        }

        // PUT /api/v1/saker/:id
        if (method === "PUT" && parts.length === 4) {
          const body = init && init.body ? JSON.parse(init.body as string) : {};
          mockSaker[sakIndex] = { ...mockSaker[sakIndex], ...body, endretTidspunkt: now() };
          return jsonResponse(mockSaker[sakIndex]);
        }

        // DELETE /api/v1/saker/:id
        if (method === "DELETE" && parts.length === 4) {
          mockSaker.splice(sakIndex, 1);
          return new Response(null, { status: 204 });
        }

        // Tilganger endpoints: /api/v1/saker/:id/tilganger
        if (parts[4] === "tilganger") {
          // POST add tilgang
          if (method === "POST") {
            const body = init && init.body ? JSON.parse(init.body as string) : {};
            const tilgang = { navIdent: body.navIdent, gittAv: "Z123456", gittTidspunkt: now() };
            mockSaker[sakIndex].tilganger.push(tilgang);
            return jsonResponse(tilgang, 201);
          }

          // DELETE /api/v1/saker/:id/tilganger/:navIdent
          if (method === "DELETE" && parts.length === 6) {
            const navIdent = parts[5];
            mockSaker[sakIndex].tilganger = mockSaker[sakIndex].tilganger.filter((t: any) => t.navIdent !== navIdent);
            return new Response(null, { status: 204 });
          }
        }
      }
    }
  } catch (err) {
    console.error("Mock fetch error", err);
    return new Response(null, { status: 500 });
  }

  // falling back to real fetch for anything else
  return originalFetch(input, init);
}

// Install mock - check both DEV and window location
if ((import.meta as any).env.DEV) {
  // @ts-ignore
  window.fetch = mockFetch;
  console.info("[Mocks] Dev fetch mocks installed");
}

export {};
