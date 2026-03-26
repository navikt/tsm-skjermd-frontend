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
  Loader,
} from "@navikt/ds-react";
import {
  PersonIcon,
  PlusIcon,
  TrashIcon,
} from "@navikt/aksel-icons";
import { sakApi } from "../api/sakApi";
import { SensureringEditor } from "../components/SensureringEditor";
import type { Sak } from "../api/types";

export const SakIframe = () => {
  const { sakId } = useParams<{ sakId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [tilgang, setTilgang] = useState<"loading" | "ok" | "denied">("loading");
  const [sak, setSak] = useState<Sak | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTilgangModal, setShowTilgangModal] = useState(false);
  const [newNavIdent, setNewNavIdent] = useState("");
  const [tilgangLoading, setTilgangLoading] = useState(false);

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
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Kunne ikke hente sak");
      });
  }, [tilgang, sakId]);

  useEffect(() => {
    const sendHeight = () => {
      const height = document.documentElement.scrollHeight;
      window.parent.postMessage({ type: "tsm-skjermd-resize", height }, "*");
    };

    sendHeight();

    const observer = new ResizeObserver(sendHeight);
    observer.observe(document.documentElement);

    return () => observer.disconnect();
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
    <div className="p-2">
      <VStack gap="3">
        {error && (
          <Alert variant="error" size="small" closeButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <SensureringEditor
          sakId={sakId}
          autoSave
          onAuthError={() => setTilgang("denied")}
        />

        {sak && (
          <VStack gap="2">
            <HStack justify="space-between" align="center">
              <Detail weight="semibold">Tilganger</Detail>
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
        )}

        {!sak && !error && (
          <HStack gap="2" align="center">
            <Loader size="small" />
            <BodyShort size="small">Laster tilganger...</BodyShort>
          </HStack>
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
