import { useParams, useSearchParams } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Alert,
  Button,
  VStack,
  HStack,
  Table,
  Tag,
  Detail,
  BodyShort,
  Accordion,
  UNSAFE_Combobox,
  Textarea,
} from "@navikt/ds-react";
import {
  PersonIcon,
  TrashIcon,
} from "@navikt/aksel-icons";
import { brukerApi, kommentarApi, filApi, leseloggApi, sakApi } from "../api/sakApi";
import type { BrukerSøkResult, FilInfo, Kommentar, Sak } from "../api/types";
import { SensureringEditor } from "../components/SensureringEditor";
import { FileUploadZone } from "../components/FileUploadZone";
import { FileList } from "../components/FileList";

const LESELOGG_CACHE_TTL = 60 * 60 * 1000;

function erLeseloggCachet(sakId: string): boolean {
  const raw = sessionStorage.getItem(`leselogg-${sakId}`);
  if (!raw) return false;
  return Date.now() - Number(raw) < LESELOGG_CACHE_TTL;
}

function cacheLeselogg(sakId: string) {
  sessionStorage.setItem(`leselogg-${sakId}`, String(Date.now()));
}

export const SakIframe = () => {
  const { sakId } = useParams<{ sakId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [tilgang, setTilgang] = useState<"loading" | "ok" | "denied">("loading");
  const [sak, setSak] = useState<Sak | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newNavIdent, setNewNavIdent] = useState("");
  const [tilgangLoading, setTilgangLoading] = useState(false);
  const [brukerSøkResultater, setBrukerSøkResultater] = useState<BrukerSøkResult[]>([]);
  const [brukerSøkLoading, setBrukerSøkLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [kommentarer, setKommentarer] = useState<Kommentar[]>([]);
  const [kommentarerLoading, setKommentarerLoading] = useState(false);
  const [beskrivelseEditorKey, setBeskrivelseEditorKey] = useState(0);
  const [kommentarEditorKey, setKommentarEditorKey] = useState(0);
  const [beskrivelseEditing, setBeskrivelseEditing] = useState(false);
  const [kommentarEditing, setKommentarEditing] = useState(false);
  const [visningGodkjent, setVisningGodkjent] = useState(() => !!sakId && erLeseloggCachet(sakId));
  const [visBegrunnelse, setVisBegrunnelse] = useState(false);
  const [begrunnelse, setBegrunnelse] = useState("");
  const [begrunnelseLoading, setBegrunnelseLoading] = useState(false);
  const [filer, setFiler] = useState<FilInfo[]>([]);

  useEffect(() => {
    if (!token || !sakId) {
      setTilgang("denied");
      return;
    }

    fetch(`/api/validate-embed-token?token=${encodeURIComponent(token)}&sakId=${encodeURIComponent(sakId)}`)
      .then((res) => {
        setTilgang(res.ok ? "ok" : "denied");
      })
      .catch(() => {
        setTilgang("denied");
      });
  }, [token, sakId]);

  useEffect(() => {
    if (tilgang !== "ok" || !sakId) return;
    sakApi
      .hentPaId(sakId)
      .then(setSak)
      .catch((err) => {
        if (err instanceof Error && /403|404/.test(err.message)) {
          setTilgang("denied");
          return;
        }
        setError("Kunne ikke hente sak");
      });
  }, [tilgang, sakId]);

  useEffect(() => {
    if (tilgang !== "ok" || !sakId) return;

    setKommentarerLoading(true);
    kommentarApi
      .hentAlle(sakId)
      .then(setKommentarer)
      .catch((err) => {
        if (err instanceof Error && /403|404/.test(err.message)) {
          setTilgang("denied");
          return;
        }
      })
      .finally(() => {
        setKommentarerLoading(false);
      });

    filApi
      .hentAlle(sakId)
      .then(setFiler)
      .catch(() => {});
  }, [tilgang, sakId]);

  useEffect(() => {
    let lastHeight = 0;

    const reportHeight = () => {
      const root = document.getElementById("root");
      let height = root ? root.scrollHeight : document.body?.scrollHeight ?? 0;

      const modal = document.querySelector("dialog[open]");
      if (modal) {
        const modalRect = modal.getBoundingClientRect();
        const modalBottom = modalRect.top + window.scrollY + modalRect.height;
        height = Math.max(height, modalBottom);
      }

      if (height > 0 && height !== lastHeight) {
        lastHeight = height;
        window.parent.postMessage({ type: "tsm-skjermd-resize", height }, "*");
      }
    };

    reportHeight();

    const resizeObserver = new ResizeObserver(reportHeight);
    if (document.body) resizeObserver.observe(document.body);

    const mutationObserver = new MutationObserver(reportHeight);
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    const interval = setInterval(reportHeight, 200);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      clearInterval(interval);
    };
  }, []);

  const handleGiTilgang = async () => {
    if (!sakId || !newNavIdent.trim()) return;
    try {
      setTilgangLoading(true);
      const nyTilgang = await sakApi.giTilgang(sakId, {
        navIdent: newNavIdent.trim().toUpperCase(),
      });
      setSak((prev) =>
        prev ? { ...prev, tilganger: [...prev.tilganger, nyTilgang] } : prev
      );
      setNewNavIdent("");
      setBrukerSøkResultater([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gi tilgang");
    } finally {
      setTilgangLoading(false);
    }
  };

  const handleBrukerSøk = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setBrukerSøkResultater([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setBrukerSøkLoading(true);
      try {
        const resultater = await brukerApi.søk(query);
        setBrukerSøkResultater(resultater);
      } catch {
        setBrukerSøkResultater([]);
      } finally {
        setBrukerSøkLoading(false);
      }
    }, 300);
  }, []);

  const handleFjernTilgang = async (navIdent: string) => {
    if (!sakId) return;
    try {
      await sakApi.fjernTilgang(sakId, navIdent);
      setSak((prev) =>
        prev
          ? { ...prev, tilganger: prev.tilganger.filter((t) => t.navIdent !== navIdent) }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke fjerne tilgang");
    }
  };

  const tekstTilJira = (tekst: string): string => {
    if (tekst.length === 0) return "[Maskert]";
    if ([...tekst].every((c) => c === "*")) return "[Maskert]";
    return tekst;
  };

  const createCommentInJira = (issueKey: string, text: string) => {
    const requestId = crypto.randomUUID();

    window.parent.postMessage({
      type: 'CREATE_JIRA_COMMENT',
      requestId,
      issueKey,
      text
    }, '*');

    return requestId;
  };

  const sendBeskrivelseTilJira = async (jiraTekst: string) => {
    if (!sakId || !sak?.jiraIssueKey || !token) return;

    try {
      setError(null);

      await fetch("/embed/api/jira/update-description", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          issueKey: sak.jiraIssueKey,
          text: jiraTekst,
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke oppdatere Jira-beskrivelse");
    }
  };

  const handleLagreBeskrivelse = (sensurertTekst: string) => {
    setBeskrivelseEditing(false);
    if (!sak?.jiraIssueKey || !token) return;
    const jiraTekst = tekstTilJira(sensurertTekst);
    sendBeskrivelseTilJira(jiraTekst);
  };

  const formatDato = (dato: string | null) => {
    if (!dato) return "-";
    return new Date(dato).toLocaleDateString("nb-NO", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const formatTid = (dato: string | null) => {
    if (!dato) return "";
    return new Date(dato).toLocaleTimeString("nb-NO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!sakId) {
    return <p>Mangler sakId</p>;
  }

  if (tilgang === "loading") {
    return null;
  }

  if (tilgang === "denied") {
    return (
      <div className="p-4 pl-6" style={{ backgroundColor: "var(--ax-bg-danger-soft)", borderLeft: "4px solid var(--ax-border-danger)" }}>
        <VStack gap="space-12" align="start">
          <BodyShort>
            Du har ikke tilgang til å se sensitiv informasjon for denne saken.
          </BodyShort>
          <Button
            variant="primary"
            size="small"
            onClick={() => {
              alert("Forespørsel om tilgang er ikke implementert ennå.");
            }}
          >
            Be om tilgang
          </Button>
        </VStack>
      </div>
    );
  }

  if (!visningGodkjent) {
    return (
      <div className="p-4 pl-6" style={{ backgroundColor: "var(--ax-bg-danger-soft)", borderLeft: "4px solid var(--ax-border-danger)" }}>
        <VStack gap="space-16" align="start">
          <BodyShort size="small">
            Denne saken inneholder sensitiv informasjon.
          </BodyShort>
          {!visBegrunnelse ? (
            <Button
              variant="primary"
              size="small"
              onClick={() => setVisBegrunnelse(true)}
            >
              Vis sensitiv informasjon
            </Button>
          ) : (
            <>
              <BodyShort weight="semibold">Begrunn tilgang</BodyShort>
              <BodyShort size="small">
                For å se innholdet må du oppgi en begrunnelse. Tilgangen vil bli logget.
              </BodyShort>
              {error && (
                <Alert variant="error" size="small" closeButton onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}
              <Textarea
                label="Begrunnelse"
                description="Oppgi en kort begrunnelse (minst 10 tegn)"
                value={begrunnelse}
                onChange={(e) => setBegrunnelse(e.target.value)}
                minRows={3}
              />
              <HStack gap="space-8">
                <Button
                  size="small"
                  onClick={async () => {
                    if (!sakId) return;
                    setBegrunnelseLoading(true);
                    try {
                      await leseloggApi.registrer(sakId, begrunnelse);
                      cacheLeselogg(sakId);
                      setVisningGodkjent(true);
                      setBegrunnelse("");
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Kunne ikke registrere leselogg");
                    } finally {
                      setBegrunnelseLoading(false);
                    }
                  }}
                  loading={begrunnelseLoading}
                  disabled={begrunnelse.trim().length < 10}
                >
                  Bekreft
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => {
                    setVisBegrunnelse(false);
                    setBegrunnelse("");
                    setError(null);
                  }}
                >
                  Avbryt
                </Button>
              </HStack>
            </>
          )}
        </VStack>
      </div>
    );
  }

  return (
    <div className="p-4 pl-6" style={{ borderLeft: "4px solid var(--ax-border-danger)" }}>
      {sak && (
        <div className="mb-4">
          <Accordion className="accordion-borderless">
            <Accordion.Item>
              <div className="flex justify-end">
                <Accordion.Header style={{ width: 'auto' }}>
                  <HStack gap="space-8" align="center">
                    <BodyShort size="small" weight="semibold">Tilganger</BodyShort>
                    <Tag variant="neutral" size="xsmall">{sak.tilganger.length}</Tag>
                  </HStack>
                </Accordion.Header>
              </div>
              <Accordion.Content>
                <VStack gap="space-8">
                  {sak.tilganger.length === 0 ? (
                    <Detail className="text-gray-500">
                      Ingen har tilgang ennå. Oppretteren ({sak.opprettetAv}) har alltid tilgang.
                    </Detail>
                  ) : (
                    <Table size="small">
                      <Table.Header>
                        <Table.Row>
                          <Table.HeaderCell>NAVident</Table.HeaderCell>
                          <Table.HeaderCell>Gitt av</Table.HeaderCell>
                          <Table.HeaderCell>Tidspunkt</Table.HeaderCell>
                          <Table.HeaderCell />
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {sak.tilganger.map((t) => (
                          <Table.Row key={t.navIdent}>
                            <Table.DataCell>
                              <HStack gap="space-4" align="center">
                                <PersonIcon aria-hidden fontSize="1rem" />
                                {t.navIdent}
                                {t.navIdent === sak.opprettetAv && (
                                  <Tag variant="neutral" size="xsmall">Oppretter</Tag>
                                )}
                              </HStack>
                            </Table.DataCell>
                            <Table.DataCell>{t.gittAv}</Table.DataCell>
                            <Table.DataCell>
                              {formatDato(t.gittTidspunkt)} kl. {formatTid(t.gittTidspunkt)}
                            </Table.DataCell>
                            <Table.DataCell>
                              {t.navIdent !== sak.opprettetAv && (
                                <Button
                                  variant="tertiary-neutral"
                                  size="xsmall"
                                  icon={<TrashIcon aria-hidden />}
                                  onClick={() => handleFjernTilgang(t.navIdent)}
                                  title="Fjern tilgang"
                                />
                              )}
                            </Table.DataCell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table>
                  )}
                  <Detail className="text-gray-500">
                    Oppretteren ({sak.opprettetAv}) har alltid tilgang og kan ikke fjernes.
                  </Detail>
                  <UNSAFE_Combobox
                    label="Gi tilgang"
                    description="Søk etter navn eller NAVident"
                    options={[]}
                    filteredOptions={brukerSøkResultater.map((b) => ({
                      label: `${b.displayName} (${b.navIdent})`,
                      value: b.navIdent,
                    }))}
                    isLoading={brukerSøkLoading}
                    onChange={handleBrukerSøk}
                    onToggleSelected={(value, isSelected) => {
                      setNewNavIdent(isSelected ? value : "");
                    }}
                    shouldAutocomplete={false}
                  />
                  <Button
                    size="small"
                    onClick={handleGiTilgang}
                    loading={tilgangLoading}
                    disabled={!newNavIdent.trim()}
                  >
                    Gi tilgang
                  </Button>
                </VStack>
              </Accordion.Content>
            </Accordion.Item>
          </Accordion>
        </div>
      )}

      <VStack gap="space-12">
        {error && (
          <Alert variant="error" size="small" closeButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <BodyShort size="small" weight="semibold">Beskrivelse</BodyShort>
        <div
          className={`p-4 rounded transition-all ${beskrivelseEditing ? '' : 'cursor-pointer hover:brightness-95'}`}
          style={{ backgroundColor: "var(--ax-bg-danger-soft)" }}
          onClick={() => { if (!beskrivelseEditing) setBeskrivelseEditing(true); }}
        >
          <SensureringEditor
            key={beskrivelseEditorKey}
            sakId={sakId!}
            singleSaveButton
            lagreKnappTekst="Lagre"
            showButtons={beskrivelseEditing}
            onLagreOgLukk={handleLagreBeskrivelse}
            onAvbryt={() => {
              setBeskrivelseEditing(false);
              setBeskrivelseEditorKey((k) => k + 1);
            }}
          />
        </div>

        <BodyShort size="small" weight="semibold">Kommentar</BodyShort>
        <div
          className="p-4 rounded"
          style={{ backgroundColor: "var(--ax-bg-danger-soft)" }}
        >
          <div
            className={`transition-all ${kommentarEditing ? '' : 'cursor-pointer hover:brightness-95'}`}
            onClick={() => { if (!kommentarEditing) setKommentarEditing(true); }}
          >
            <SensureringEditor
              key={kommentarEditorKey}
              sakId={sakId!}
              kommentarModus
              singleSaveButton
              lagreKnappTekst="Lagre"
              showButtons={kommentarEditing}
              onAvbryt={() => {
                setKommentarEditing(false);
                setKommentarEditorKey((k) => k + 1);
              }}
              onLagreOgLukk={async (sensurertTekst) => {
                if (!sensurertTekst.trim()) {
                  setKommentarEditing(false);
                  setKommentarEditorKey((k) => k + 1);
                  return;
                }
                if (sak?.jiraIssueKey) {
                  try {
                    const nyKommentar = await kommentarApi.opprett(sakId, { tekst: sensurertTekst });
                    setKommentarer((prev) => [nyKommentar, ...prev]);
                    const jiraTekst = tekstTilJira(sensurertTekst);
                    createCommentInJira(sak.jiraIssueKey!, jiraTekst);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Kunne ikke opprette kommentar");
                    return;
                  }
                }
                setKommentarEditing(false);
                setKommentarEditorKey((k) => k + 1);
              }}
            />
          </div>
          {sak && (
            <Accordion className="mt-4 accordion-borderless">
              <Accordion.Item>
                <Accordion.Header>
                  <HStack gap="space-8" align="center">
                    <BodyShort size="small" weight="semibold">Kommentarer</BodyShort>
                    <Tag variant="neutral" size="xsmall">{kommentarer.length}</Tag>
                  </HStack>
                </Accordion.Header>
                <Accordion.Content>
                  <VStack gap="space-8">
                    {kommentarerLoading ? (
                      <Detail className="text-gray-500">Laster kommentarer...</Detail>
                    ) : kommentarer.length === 0 ? (
                      <Detail className="text-gray-500">Ingen kommentarer registrert ennå.</Detail>
                    ) : (
                      <Table size="small">
                        <Table.Header>
                          <Table.Row>
                            <Table.HeaderCell>Kommentar</Table.HeaderCell>
                            <Table.HeaderCell>Skrevet av</Table.HeaderCell>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {kommentarer.map((kommentar) => (
                            <Table.Row key={kommentar.id}>
                              <Table.DataCell>
                                <BodyShort size="small" className="whitespace-pre-wrap">
                                  {kommentar.originalTekst}
                                </BodyShort>
                              </Table.DataCell>
                              <Table.DataCell>
                                <BodyShort size="small">
                                  {formatDato(kommentar.opprettetTidspunkt)} kl. {formatTid(kommentar.opprettetTidspunkt)} — {kommentar.opprettetAv}
                                </BodyShort>
                              </Table.DataCell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table>
                    )}
                  </VStack>
                </Accordion.Content>
              </Accordion.Item>
            </Accordion>
          )}
        </div>

        <BodyShort size="small" weight="semibold">Filer</BodyShort>
        <div className="p-4 rounded" style={{ backgroundColor: "var(--ax-bg-danger-soft)" }}>
          <VStack gap="space-8">
            <FileUploadZone
              sakId={sakId!}
              onFileUploaded={(fil) => setFiler((prev) => [fil, ...prev])}
            />
            <FileList
              filer={filer}
              sakId={sakId!}
              onFileDeleted={(filId) => setFiler((prev) => prev.filter((f) => f.id !== filId))}
            />
          </VStack>
        </div>
      </VStack>
    </div>
  );
};
