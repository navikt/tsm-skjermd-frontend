// Development fetch mocks for local dev environment
import { createLogger } from "../logger";
import type { AuditHendelse, Gruppe, GruppeMedlem, GruppeTilgang, Sak } from "../api/types";

const log = createLogger("Mocks");
const originalFetch = window.fetch.bind(window);

const now = () => new Date().toISOString();

const mockGrupper: (Gruppe & { medlemmer: GruppeMedlem[] })[] = [
  {
    id: "team-service-management",
    navn: "Team Service Management",
    type: "TEAM",
    beskrivelse: "Utvikler saksflyt for NAV Digital",
    antallMedlemmer: 3,
    medlemmer: [
      { navIdent: "Z123456", displayName: "Test Bruker", email: "test.bruker@nav.no" },
      { navIdent: "Z222222", displayName: "Kari Nordmann", email: "kari.nordmann@nav.no" },
      { navIdent: "Z333333", displayName: "Ola Nordmann", email: "ola.nordmann@nav.no" },
    ],
  },
  {
    id: "team-brukerdialog",
    navn: "Team Brukerdialog",
    type: "TEAM",
    beskrivelse: null,
    antallMedlemmer: 2,
    medlemmer: [
      { navIdent: "Z444444", displayName: "Per Hansen", email: "per.hansen@nav.no" },
      { navIdent: "Z555555", displayName: "Line Berg", email: "line.berg@nav.no" },
    ],
  },
  {
    id: "omraade-arbeid",
    navn: "Produktområde Arbeid",
    type: "PRODUKTOMRAADE",
    beskrivelse: "Område for arbeidsrettede tjenester",
    antallMedlemmer: 2,
    medlemmer: [
      { navIdent: "Z666666", displayName: "Nina Dahl", email: "nina.dahl@nav.no" },
      { navIdent: "Z777777", displayName: "Jon Lie", email: "jon.lie@nav.no" },
    ],
  },
];

const mockAuditlogg: Record<string, AuditHendelse[]> = {};

let auditId = 1;

function auditlogg(sakId: string, hendelse: Omit<AuditHendelse, "id" | "tidspunkt">) {
  const logg = mockAuditlogg[sakId] ?? (mockAuditlogg[sakId] = []);
  logg.unshift({ id: `AUDIT-${auditId++}`, tidspunkt: now(), ...hendelse });
}

const mockSaker: Sak[] = [
  {
    id: "SAK-1",
    opprettetAv: "Z123456",
    opprettetTidspunkt: now(),
    endretAv: null,
    endretTidspunkt: null,
    sensitivData: "Dette er sensitiv informasjon for SAK-1",
    tilganger: [
      { navIdent: "Z123456", gittAv: "Z123456", gittTidspunkt: now(), kilde: "DIREKTE" },
    ],
    gruppeTilganger: [],
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
    gruppeTilganger: [],
    jiraIssueKey: "PROJ-123",
  },
];

let nextId = 3;

function jsonResponse(body: unknown, status = 200) {
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

    // Teamkatalogen-grupper
    if (url.includes("/grupper")) {
      const path = url.replace(/^https?:\/\/[^/]+/, "");
      const [pathname, query] = path.split("?");
      const parts = pathname.split("/").filter(Boolean);
      const gruppeIndex = parts.indexOf("grupper");

      if (method === "GET" && gruppeIndex === parts.length - 1) {
        const q = (new URLSearchParams(query ?? "").get("q") ?? "").toLowerCase();
        const treff = mockGrupper
          .filter((g) => g.navn.toLowerCase().includes(q))
          .map((g) => ({
            id: g.id,
            navn: g.navn,
            type: g.type,
            beskrivelse: g.beskrivelse,
            antallMedlemmer: g.antallMedlemmer,
          }));
        return jsonResponse(treff);
      }

      if (method === "GET" && parts[gruppeIndex + 2] === "medlemmer") {
        const gruppe = mockGrupper.find((g) => g.id === parts[gruppeIndex + 1]);
        if (!gruppe) return new Response(null, { status: 404 });
        return jsonResponse(gruppe.medlemmer);
      }
    }

    // API v1 saker
    if (url.startsWith("/v1/saker") || url.includes("/v1/saker")) {
      const path = url.replace(/^https?:\/\/[^/]+/, "");
      const parts = path.split("/").filter(Boolean); // ['v1','saker', ...]

      // GET /v1/saker
      if (method === "GET" && parts.length === 2) {
        return jsonResponse(mockSaker);
      }

      // POST /v1/saker
      if (method === "POST" && parts.length === 2) {
        const body = init && init.body ? JSON.parse(init.body as string) : {};
        const newSak = {
          id: `SAK-${nextId++}`,
          opprettetAv: "Z123456",
          opprettetTidspunkt: now(),
          endretAv: null,
          endretTidspunkt: null,
          sensitivData: body.sensitivData || "",
          tilganger: [
            { navIdent: "Z123456", gittAv: "Z123456", gittTidspunkt: now(), kilde: "DIREKTE" as const },
          ],
          gruppeTilganger: [],
          jiraIssueKey: body.jiraIssueKey || null,
        };
        mockSaker.push(newSak);
        return jsonResponse(newSak, 201);
      }

      // operations on /v1/saker/:id
      if (parts.length >= 3) {
        const id = parts[2];
        const sakIndex = mockSaker.findIndex((s) => s.id === id);
        if (sakIndex === -1) return new Response(null, { status: 404 });

        // GET /v1/saker/:id
        if (method === "GET" && parts.length === 3) {
          return jsonResponse(mockSaker[sakIndex]);
        }

        // PUT /v1/saker/:id
        if (method === "PUT" && parts.length === 3) {
          const body = init && init.body ? JSON.parse(init.body as string) : {};
          mockSaker[sakIndex] = { ...mockSaker[sakIndex], ...body, endretTidspunkt: now() };
          return jsonResponse(mockSaker[sakIndex]);
        }

        // DELETE /v1/saker/:id
        if (method === "DELETE" && parts.length === 3) {
          mockSaker.splice(sakIndex, 1);
          return new Response(null, { status: 204 });
        }

        // Tilganger endpoints: /v1/saker/:id/tilganger
        if (parts[3] === "tilganger") {
          // POST add tilgang
          if (method === "POST") {
            const body = init && init.body ? JSON.parse(init.body as string) : {};
            const tilgang = {
              navIdent: body.navIdent,
              gittAv: "Z123456",
              gittTidspunkt: now(),
              kilde: "DIREKTE" as const,
            };
            mockSaker[sakIndex].tilganger.push(tilgang);
            auditlogg(id, {
              utfoertAv: "Z123456",
              handling: "TILGANG_GITT",
              navIdent: tilgang.navIdent,
              gruppeId: null,
              gruppeNavn: null,
              antallBerorte: 1,
            });
            return jsonResponse(tilgang, 201);
          }

          // DELETE /v1/saker/:id/tilganger/:navIdent
          if (method === "DELETE" && parts.length === 5) {
            const navIdent = parts[4];
            mockSaker[sakIndex].tilganger = mockSaker[sakIndex].tilganger.filter(
              (t) => !(t.navIdent === navIdent && t.kilde !== "GRUPPE")
            );
            auditlogg(id, {
              utfoertAv: "Z123456",
              handling: "TILGANG_FJERNET",
              navIdent,
              gruppeId: null,
              gruppeNavn: null,
              antallBerorte: 1,
            });
            return new Response(null, { status: 204 });
          }
        }

        // Gruppetilganger: /v1/saker/:id/gruppetilganger
        if (parts[3] === "gruppetilganger") {
          const sak = mockSaker[sakIndex];

          if (method === "POST") {
            const body = init && init.body ? JSON.parse(init.body as string) : {};
            const gruppe = mockGrupper.find((g) => g.id === body.gruppeId);
            if (!gruppe) return new Response(null, { status: 404 });

            if ((sak.gruppeTilganger ?? []).some((g) => g.gruppeId === gruppe.id)) {
              return jsonResponse({ message: "Gruppen har allerede tilgang" }, 409);
            }

            const tidspunkt = now();
            const gruppeTilgang: GruppeTilgang = {
              gruppeId: gruppe.id,
              gruppeNavn: gruppe.navn,
              gruppeType: gruppe.type,
              gittAv: "Z123456",
              gittTidspunkt: tidspunkt,
              medlemmer: gruppe.medlemmer.map((m) => m.navIdent),
            };

            const nyeTilganger = gruppe.medlemmer
              .filter(
                (m) =>
                  !sak.tilganger.some(
                    (t) => t.navIdent === m.navIdent && t.gruppeId === gruppe.id
                  )
              )
              .map((m) => ({
                navIdent: m.navIdent,
                gittAv: "Z123456",
                gittTidspunkt: tidspunkt,
                kilde: "GRUPPE" as const,
                gruppeId: gruppe.id,
                gruppeNavn: gruppe.navn,
              }));

            sak.tilganger = [...sak.tilganger, ...nyeTilganger];
            sak.gruppeTilganger = [...(sak.gruppeTilganger ?? []), gruppeTilgang];

            auditlogg(id, {
              utfoertAv: "Z123456",
              handling: "GRUPPETILGANG_GITT",
              navIdent: null,
              gruppeId: gruppe.id,
              gruppeNavn: gruppe.navn,
              antallBerorte: nyeTilganger.length,
            });

            return jsonResponse({ gruppeTilgang, tilganger: sak.tilganger }, 201);
          }

          // DELETE /v1/saker/:id/gruppetilganger/:gruppeId
          if (method === "DELETE" && parts.length === 5) {
            const gruppeId = parts[4];
            const fjernet = sak.tilganger.filter((t) => t.gruppeId === gruppeId).length;
            sak.tilganger = sak.tilganger.filter((t) => t.gruppeId !== gruppeId);
            sak.gruppeTilganger = (sak.gruppeTilganger ?? []).filter(
              (g) => g.gruppeId !== gruppeId
            );
            auditlogg(id, {
              utfoertAv: "Z123456",
              handling: "GRUPPETILGANG_FJERNET",
              navIdent: null,
              gruppeId,
              gruppeNavn: mockGrupper.find((g) => g.id === gruppeId)?.navn ?? gruppeId,
              antallBerorte: fjernet,
            });
            return new Response(null, { status: 204 });
          }
        }

        // GET /v1/saker/:id/auditlogg
        if (parts[3] === "auditlogg" && method === "GET") {
          return jsonResponse(mockAuditlogg[id] ?? []);
        }
      }
    }
  } catch (err) {
    log.error("Mock fetch error", err);
    return new Response(null, { status: 500 });
  }

  // falling back to real fetch for anything else
  return originalFetch(input, init);
}

// Install mock - check both DEV and window location
if (import.meta.env.DEV) {
  window.fetch = mockFetch as typeof window.fetch;
  log.info("Dev fetch mocks installed");
}

export {};
