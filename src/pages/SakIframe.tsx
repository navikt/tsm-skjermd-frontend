import { useParams, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Alert,
  Button,
  TextField,
  VStack,
  HStack,
  Table,
  Tag,
  Detail,
  Modal,
  BodyShort,
  Accordion,
} from "@navikt/ds-react";
import {
  PersonIcon,
  PlusIcon,
  TrashIcon,
} from "@navikt/aksel-icons";
import { kommentarApi, sakApi } from "../api/sakApi";
import type { Kommentar, Sak } from "../api/types";
import { SensureringEditor } from "../components/SensureringEditor";

export const SakIframe = () => {
  const { sakId } = useParams<{ sakId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [tilgang, setTilgang] = useState<"loading" | "ok" | "denied">("loading");
  const [sak, setSak] = useState<Sak | null>(null);
  const [sakTilgjengelig, setSakTilgjengelig] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTilgangModal, setShowTilgangModal] = useState(false);
  const [newNavIdent, setNewNavIdent] = useState("");
  const [tilgangLoading, setTilgangLoading] = useState(false);
  const [kommentarer, setKommentarer] = useState<Kommentar[]>([]);
  const [kommentarerLoading, setKommentarerLoading] = useState(false);
  const [beskrivelseEditorKey, setBeskrivelseEditorKey] = useState(0);
  const [kommentarEditorKey, setKommentarEditorKey] = useState(0);
  const [beskrivelseEditing, setBeskrivelseEditing] = useState(false);
  const [kommentarEditing, setKommentarEditing] = useState(false);
  const [previewModal, setPreviewModal] = useState<{ tekst: string; type: "beskrivelse" | "kommentar"; onBekreft: () => void } | null>(null);

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
        setSakTilgjengelig(false);
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
        setError("Kunne ikke hente kommentarer");
      })
      .finally(() => {
        setKommentarerLoading(false);
      });
  }, [tilgang, sakId]);

  useEffect(() => {
    let lastHeight = 0;

    const reportHeight = () => {
      const root = document.getElementById("root");
      const height = root ? root.scrollHeight : document.body?.scrollHeight ?? 0;
      if (height > 0 && height !== lastHeight) {
        lastHeight = height;
        window.parent.postMessage({ type: "tsm-skjermd-resize", height }, "*");
      }
    };

    reportHeight();

    const resizeObserver = new ResizeObserver(reportHeight);
    if (document.body) resizeObserver.observe(document.body);

    const interval = setInterval(reportHeight, 200);

    return () => {
      resizeObserver.disconnect();
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
      setShowTilgangModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gi tilgang");
    } finally {
      setTilgangLoading(false);
    }
  };

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
    setPreviewModal({
      tekst: jiraTekst,
      type: "beskrivelse",
      onBekreft: () => {
        setPreviewModal(null);
        sendBeskrivelseTilJira(jiraTekst);
      },
    });
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
      <div className="p-4" style={{ backgroundColor: "var(--ax-bg-danger-soft)" }}>
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

  return (
    <div className="p-4">
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

        {sak && (
          <Accordion>
            <Accordion.Item>
              <Accordion.Header>
                <HStack gap="space-8" align="center">
                  <BodyShort size="small" weight="semibold">Tilganger</BodyShort>
                  <Tag variant="neutral" size="xsmall">{sak.tilganger.length}</Tag>
                </HStack>
              </Accordion.Header>
              <Accordion.Content>
                <VStack gap="space-8">
                  <HStack justify="space-between" align="center">
                    <Detail weight="semibold">Administrer tilganger</Detail>
                    <Button
                      variant="tertiary"
                      size="xsmall"
                      icon={<PlusIcon aria-hidden />}
                      onClick={() => setShowTilgangModal(true)}
                    >
                      Gi tilgang
                    </Button>
                  </HStack>

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
                </VStack>
              </Accordion.Content>
            </Accordion.Item>
          </Accordion>
        )}

        {!sak && !sakTilgjengelig && (
          <Detail className="text-gray-500">Tilgangspanelet er ikke tilgjengelig i denne visningen.</Detail>
        )}

        <BodyShort size="small" weight="semibold">Kommentar</BodyShort>
        {sak && (
          <Accordion>
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

        <div
          className={`p-4 rounded transition-all ${kommentarEditing ? '' : 'cursor-pointer hover:brightness-95'}`}
          style={{ backgroundColor: "var(--ax-bg-danger-soft)" }}
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
                  setPreviewModal({
                    tekst: jiraTekst,
                    type: "kommentar",
                    onBekreft: () => {
                      setPreviewModal(null);
                      createCommentInJira(sak.jiraIssueKey!, jiraTekst);
                    },
                  });
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
      </VStack>

      <Modal
        open={showTilgangModal}
        onClose={() => {
          setShowTilgangModal(false);
          setNewNavIdent("");
        }}
        header={{ heading: "Gi tilgang", closeButton: true }}
      >
        <Modal.Body>
          <VStack gap="space-16">
            <BodyShort>
              Gi en bruker tilgang til saken <strong>{sak?.jiraIssueKey ?? sakId}</strong>.
            </BodyShort>
            <TextField
              label="NAVident"
              description="Skriv inn NAVident (f.eks. Z123456)"
              value={newNavIdent}
              onChange={(e) => setNewNavIdent(e.target.value)}
              placeholder="Z123456"
            />
          </VStack>
        </Modal.Body>
        <Modal.Footer>
          <Button
            onClick={handleGiTilgang}
            loading={tilgangLoading}
            disabled={!newNavIdent.trim()}
          >
            Gi tilgang
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setShowTilgangModal(false);
              setNewNavIdent("");
            }}
          >
            Avbryt
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        open={previewModal !== null}
        onClose={() => setPreviewModal(null)}
        header={{
          heading: previewModal?.type === "beskrivelse"
            ? "Forhåndsvisning av beskrivelse"
            : "Forhåndsvisning av kommentar",
          closeButton: true,
        }}
      >
        <Modal.Body>
          <VStack gap="space-16">
            <BodyShort weight="semibold">
              Følgende tekst vil bli sendt til Jira ({sak?.jiraIssueKey}):
            </BodyShort>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded whitespace-pre-wrap font-mono text-sm">
              {previewModal?.tekst}
            </div>
          </VStack>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={previewModal?.onBekreft}>
            Send til Jira
          </Button>
          <Button variant="secondary" onClick={() => setPreviewModal(null)}>
            Avbryt
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};
