import { useParams, useSearchParams } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
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
  Loader,
  Box,
  Accordion,
} from "@navikt/ds-react";
import {
  PersonIcon,
  PlusIcon,
  TrashIcon,
  EyeSlashIcon,
} from "@navikt/aksel-icons";
import { sakApi, sensureringApi } from "../api/sakApi";
import type { Sak, SensurertElement } from "../api/types";

export const SakIframe = () => {
  const contentRef = useRef<HTMLDivElement>(null);
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

  const [sensurertElementer, setSensurertElementer] = useState<SensurertElement[]>([]);
  const [nyeElementer, setNyeElementer] = useState<SensurertElement[]>([]);
  const [originaltekst, setOriginaltekst] = useState("");
  const [sensurertTekst, setSensurertTekst] = useState("");
  const [sensureringLaster, setSensureringLaster] = useState(true);
  const [sensureringTilgang, setSensureringTilgang] = useState(true);
  const [nyVerdi, setNyVerdi] = useState("");
  const [leggerTil, setLeggerTil] = useState(false);

  useEffect(() => {
    if (!token || !sakId) {
      setTilgang("denied");
      return;
    }

    fetch(`/api/validate-embed-token?token=${encodeURIComponent(token)}`)
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
      .catch(() => {
        setSakTilgjengelig(false);
      });

    sensureringApi
      .hent(sakId)
      .then((data) => {
        setOriginaltekst(data.originaltekst);
        setSensurertTekst(data.sensurertTekst);
        const existing = data.sensurertElementer.filter((el) => !el.placeholder.startsWith("[NY-"));
        const nye = data.sensurertElementer.filter((el) => el.placeholder.startsWith("[NY-"));
        setSensurertElementer(existing);
        setNyeElementer(nye);
      })
      .catch(() => {
        setSensureringTilgang(false);
      })
      .finally(() => setSensureringLaster(false));
  }, [tilgang, sakId]);

  const alleElementer = [...sensurertElementer, ...nyeElementer];

  const lagreAlle = useCallback(async (elementer: SensurertElement[]) => {
    if (!sakId) return;
    await sensureringApi.lagre(sakId, {
      originaltekst,
      sensurertTekst,
      sensurertElementer: elementer,
    });
  }, [sakId, originaltekst, sensurertTekst]);

  const handleLeggTilSensurering = useCallback(async () => {
    if (!sakId || !nyVerdi.trim()) return;
    setLeggerTil(true);
    try {
      const newIndex = nyeElementer.length + 1;
      const placeholder = `[NY-${newIndex}]`;
      const oppdaterteNye = [...nyeElementer, { placeholder, original: nyVerdi.trim() }];

      await lagreAlle([...sensurertElementer, ...oppdaterteNye]);

      setNyeElementer(oppdaterteNye);
      setNyVerdi("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke legge til sensurering");
    } finally {
      setLeggerTil(false);
    }
  }, [sakId, nyVerdi, nyeElementer, sensurertElementer, lagreAlle]);

  const handleFjernNySensurering = useCallback(async (index: number) => {
    try {
      const oppdaterteNye = nyeElementer.filter((_, i) => i !== index).map((el, i) => ({
        ...el,
        placeholder: `[NY-${i + 1}]`,
      }));

      await lagreAlle([...sensurertElementer, ...oppdaterteNye]);

      setNyeElementer(oppdaterteNye);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke fjerne sensurering");
    }
  }, [nyeElementer, sensurertElementer, lagreAlle]);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    const sendHeight = () => {
      const height = Math.ceil(element.getBoundingClientRect().height);
      window.parent.postMessage({ type: "tsm-skjermd-resize", height }, "*");
    };

    sendHeight();

    const observer = new ResizeObserver(sendHeight);
    observer.observe(element);

    return () => observer.disconnect();
  }, [tilgang, sak, sensureringLaster, sensurertElementer, nyeElementer, nyVerdi, error]);

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
      <div className="p-4">
        <Alert variant="warning">Ingen tilgang</Alert>
      </div>
    );
  }

  return (
    <div ref={contentRef} className="p-4">
      <VStack gap="3">
        {error && (
          <Alert variant="error" size="small" closeButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Accordion>
          <Accordion.Item>
            <Accordion.Header>
              <HStack gap="2" align="center">
                <BodyShort size="small" weight="semibold">Sensurerte verdier</BodyShort>
                <Tag variant="neutral" size="xsmall">{alleElementer.length}</Tag>
              </HStack>
            </Accordion.Header>
            <Accordion.Content>
              <VStack gap="3">
                {sensureringLaster ? (
                  <HStack gap="2" align="center">
                    <Loader size="small" />
                    <BodyShort size="small">Laster sensurerte verdier...</BodyShort>
                  </HStack>
                ) : !sensureringTilgang ? (
                  <Detail className="text-gray-500">Du har ikke tilgang til å se sensurerte verdier.</Detail>
                ) : alleElementer.length === 0 ? (
                  <Detail className="text-gray-500">Ingen sensurerte verdier ennå.</Detail>
                ) : (
                  <VStack gap="1">
                    {sensurertElementer.map((el, i) => (
                      <Box
                        key={`existing-${i}`}
                        background="surface-subtle"
                        padding="2"
                        borderRadius="medium"
                        borderColor="border-subtle"
                        borderWidth="1"
                      >
                        <HStack gap="2" align="center">
                          <Tag variant="neutral" size="xsmall" className="font-mono">
                            {el.placeholder}
                          </Tag>
                          <code className="text-xs bg-red-50 text-red-800 px-2 py-0.5 rounded break-all">
                            {el.original}
                          </code>
                        </HStack>
                      </Box>
                    ))}
                    {nyeElementer.map((el, i) => (
                      <Box
                        key={`new-${i}`}
                        background="surface-alt-3-subtle"
                        padding="2"
                        borderRadius="medium"
                        borderColor="border-alt-3"
                        borderWidth="1"
                      >
                        <HStack gap="2" align="center" justify="space-between">
                          <HStack gap="2" align="center">
                            <Tag variant="alt3" size="xsmall" className="font-mono">
                              {el.placeholder}
                            </Tag>
                            <code className="text-xs bg-purple-50 text-purple-800 px-2 py-0.5 rounded break-all">
                              {el.original}
                            </code>
                          </HStack>
                          <Button
                            variant="tertiary-neutral"
                            size="xsmall"
                            icon={<TrashIcon aria-hidden />}
                            onClick={() => handleFjernNySensurering(i)}
                            title="Fjern sensurering"
                          />
                        </HStack>
                      </Box>
                    ))}
                  </VStack>
                )}

                {!sensureringTilgang ? (
                  <Detail className="text-gray-500">Du har ikke tilgang til å legge til sensurerte verdier.</Detail>
                ) : (
                  <Box
                    paddingBlock="2 0"
                    borderColor="border-subtle"
                    borderWidth="1 0 0"
                  >
                    <HStack gap="2" align="end">
                      <TextField
                        label="Legg til ny sensurert verdi"
                        size="small"
                        value={nyVerdi}
                        onChange={(e) => setNyVerdi(e.target.value)}
                        placeholder="Tekst som skal sensureres"
                        className="flex-1"
                      />
                      <Button
                        variant="primary"
                        size="small"
                        icon={<EyeSlashIcon aria-hidden />}
                        onClick={handleLeggTilSensurering}
                        loading={leggerTil}
                        disabled={!nyVerdi.trim()}
                      >
                        Legg til
                      </Button>
                    </HStack>
                  </Box>
                )}
              </VStack>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion>

        {sak && (
          <Accordion>
            <Accordion.Item>
              <Accordion.Header>
                <HStack gap="2" align="center">
                  <BodyShort size="small" weight="semibold">Tilganger</BodyShort>
                  <Tag variant="neutral" size="xsmall">{sak.tilganger.length}</Tag>
                </HStack>
              </Accordion.Header>
              <Accordion.Content>
                <VStack gap="2">
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
                              <HStack gap="1" align="center">
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
          <VStack gap="4">
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
    </div>
  );
};
