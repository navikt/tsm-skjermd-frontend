import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Button,
  Alert,
  Loader,
  Heading,
  Textarea,
  TextField,
  HStack,
  VStack,
  BodyShort,
  Box,
  Tag,
  Detail,
  CopyButton,
  Modal,
  ConfirmationPanel,
  Table,
} from "@navikt/ds-react";
import {
  PencilIcon,
  TrashIcon,
  ArrowLeftIcon,
  FloppydiskIcon,
  XMarkIcon,
  PersonIcon,
  ClockIcon,
  FileTextIcon,
  ExternalLinkIcon,
  PersonGroupIcon,
  PlusIcon,
} from "@navikt/aksel-icons";
import { sakApi, filApi } from "../api/sakApi";
import type { Sak, FilInfo } from "../api/types";
import { createLogger } from "../logger";
import { FileUploadZone } from "../components/FileUploadZone";
import { FileList } from "../components/FileList";

const log = createLogger("SakDetail");

export const SakDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sak, setSak] = useState<Sak | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [sensitivData, setSensitivData] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [showTilgangModal, setShowTilgangModal] = useState(false);
  const [newNavIdent, setNewNavIdent] = useState("");
  const [tilgangLoading, setTilgangLoading] = useState(false);
  const [filer, setFiler] = useState<FilInfo[]>([]);

  useEffect(() => {
    const hentSak = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const data = await sakApi.hentPaId(id);
        setSak(data);
        setSensitivData(data.sensitivData);
        filApi.hentAlle(id).then(setFiler).catch(() => {});
      } catch (err) {
        log.error(`Kunne ikke hente sak ${id}`, err);
        setError(err instanceof Error ? err.message : "Kunne ikke hente sak");
      } finally {
        setLoading(false);
      }
    };
    hentSak();
  }, [id]);

  const handleSave = async () => {
    if (!id || !sak) return;
    try {
      setSaving(true);
      const oppdatert = await sakApi.endre(id, { sensitivData });
      setSak(oppdatert);
      setEditing(false);
    } catch (err) {
      log.error(`Kunne ikke lagre endringer for sak ${id}`, err);
      setError(
        err instanceof Error ? err.message : "Kunne ikke lagre endringer"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSlett = async () => {
    if (!id) return;
    try {
      await sakApi.slett(id);
      log.info(`Sak ${id} slettet`);
      navigate("/");
    } catch (err) {
      log.error(`Kunne ikke slette sak ${id}`, err);
      setError(err instanceof Error ? err.message : "Kunne ikke slette sak");
    }
  };

  const handleCancel = () => {
    if (sak) setSensitivData(sak.sensitivData);
    setEditing(false);
  };

  const handleGiTilgang = async () => {
    if (!id || !newNavIdent.trim()) return;
    try {
      setTilgangLoading(true);
      const nyTilgang = await sakApi.giTilgang(id, { navIdent: newNavIdent.trim().toUpperCase() });
      setSak((prev) =>
        prev ? { ...prev, tilganger: [...prev.tilganger, nyTilgang] } : prev
      );
      setNewNavIdent("");
      setShowTilgangModal(false);
    } catch (err) {
      log.error(`Kunne ikke gi tilgang for sak ${id}`, err);
      setError(err instanceof Error ? err.message : "Kunne ikke gi tilgang");
    } finally {
      setTilgangLoading(false);
    }
  };

  const handleFjernTilgang = async (navIdent: string) => {
    if (!id) return;
    try {
      await sakApi.fjernTilgang(id, navIdent);
      setSak((prev) =>
        prev
          ? { ...prev, tilganger: prev.tilganger.filter((t) => t.navIdent !== navIdent) }
          : prev
      );
    } catch (err) {
      log.error(`Kunne ikke fjerne tilgang ${navIdent} for sak ${id}`, err);
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-4">
        <Loader size="xlarge" title="Laster sak..." />
        <BodyShort className="text-gray-500">Henter saksinformasjon...</BodyShort>
      </div>
    );
  }

  if (!sak) {
    return (
      <Box
        background="sunken"
        padding="space-32"
        borderRadius="8"
        className="text-center"
      >
        <VStack gap="space-16" align="center">
          <FileTextIcon className="text-gray-400" style={{ fontSize: "3rem" }} />
          <Heading size="small">Sak ikke funnet</Heading>
          <BodyShort className="text-gray-500">
            Saken du leter etter eksisterer ikke eller har blitt slettet.
          </BodyShort>
          <Button as={Link} to="/" variant="secondary">
            Tilbake til oversikt
          </Button>
        </VStack>
      </Box>
    );
  }

  return (
    <>
      <VStack gap="space-24">
        {/* Header */}
        <Box
          background="default"
          padding="space-20"
          borderRadius="8"
        >
          <HStack justify="space-between" align="start" wrap gap="space-16">
            <VStack gap="space-12">
              <HStack gap="space-8" align="center">
                <Button
                  as={Link}
                  to="/"
                  variant="tertiary-neutral"
                  size="small"
                  icon={<ArrowLeftIcon aria-hidden />}
                >
                  Tilbake
                </Button>
              </HStack>
              <HStack gap="space-12" align="center">
                <Heading size="large">{sak.jiraIssueKey ?? "Uten Jira-kobling"}</Heading>
                {sak.endretTidspunkt ? (
                  <Tag variant="warning" size="small">
                    Endret
                  </Tag>
                ) : (
                  <Tag variant="success" size="small">
                    Original
                  </Tag>
                )}
              </HStack>
              <HStack gap="space-4" align="center" className="text-gray-500">
                <Detail>ID: {sak.id}</Detail>
                <CopyButton
                  size="xsmall"
                  copyText={sak.id}
                  title="Kopier ID"
                />
              </HStack>
            </VStack>
            <HStack gap="space-8">
              {!editing && (
                <>
                  <Button
                    variant="secondary"
                    size="small"
                    icon={<PencilIcon aria-hidden />}
                    onClick={() => setEditing(true)}
                  >
                    Rediger
                  </Button>
                  <Button
                    variant="danger"
                    size="small"
                    icon={<TrashIcon aria-hidden />}
                    onClick={() => setShowDeleteModal(true)}
                  >
                    Slett
                  </Button>
                </>
              )}
            </HStack>
          </HStack>
        </Box>

        {error && (
          <Alert variant="error" closeButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Metadata */}
        <Box
          background="sunken"
          padding="space-20"
          borderRadius="8"
        >
          <VStack gap="space-16">
            <Heading size="xsmall" className="text-gray-600">
              Saksinformasjon
            </Heading>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <VStack gap="space-4">
                <HStack gap="space-4" align="center" className="text-gray-500">
                  <PersonIcon aria-hidden fontSize="1rem" />
                  <Detail>Opprettet av</Detail>
                </HStack>
                <BodyShort weight="semibold">{sak.opprettetAv}</BodyShort>
              </VStack>
              <VStack gap="space-4">
                <HStack gap="space-4" align="center" className="text-gray-500">
                  <ClockIcon aria-hidden fontSize="1rem" />
                  <Detail>Opprettet</Detail>
                </HStack>
                <BodyShort weight="semibold">
                  {formatDato(sak.opprettetTidspunkt)}
                </BodyShort>
                <Detail className="text-gray-500">
                  kl. {formatTid(sak.opprettetTidspunkt)}
                </Detail>
              </VStack>
              <VStack gap="space-4">
                <HStack gap="space-4" align="center" className="text-gray-500">
                  <PersonIcon aria-hidden fontSize="1rem" />
                  <Detail>Endret av</Detail>
                </HStack>
                <BodyShort weight="semibold">
                  {sak.endretAv || "-"}
                </BodyShort>
              </VStack>
              <VStack gap="space-4">
                <HStack gap="space-4" align="center" className="text-gray-500">
                  <ClockIcon aria-hidden fontSize="1rem" />
                  <Detail>Sist endret</Detail>
                </HStack>
                {sak.endretTidspunkt ? (
                  <>
                    <BodyShort weight="semibold">
                      {formatDato(sak.endretTidspunkt)}
                    </BodyShort>
                    <Detail className="text-gray-500">
                      kl. {formatTid(sak.endretTidspunkt)}
                    </Detail>
                  </>
                ) : (
                  <BodyShort className="text-gray-400">Ikke endret</BodyShort>
                )}
              </VStack>
            </div>
          </VStack>
        </Box>

        {/* Sensitiv data */}
        <Box
          background="default"
          padding="space-20"
          borderRadius="8"
        >
          <VStack gap="space-16">
            <HStack justify="space-between" align="center">
              <HStack gap="space-8" align="center">
                <FileTextIcon aria-hidden />
                <Heading size="xsmall">Sensitiv informasjon</Heading>
              </HStack>
              {!editing && (
                <CopyButton
                  size="small"
                  copyText={sak.sensitivData}
                  text="Kopier innhold"
                />
              )}
            </HStack>

            {editing ? (
              <VStack gap="space-16">
                <Textarea
                  label="Sensitiv informasjon"
                  hideLabel
                  value={sensitivData}
                  onChange={(e) => setSensitivData(e.target.value)}
                  rows={12}
                  className="font-mono"
                />
                <HStack gap="space-8">
                  <Button
                    icon={<FloppydiskIcon aria-hidden />}
                    onClick={handleSave}
                    loading={saving}
                  >
                    Lagre endringer
                  </Button>
                  <Button
                    variant="secondary"
                    icon={<XMarkIcon aria-hidden />}
                    onClick={handleCancel}
                  >
                    Avbryt
                  </Button>
                </HStack>
              </VStack>
            ) : (
              <Box
                background="sunken"
                padding="space-16"
                borderRadius="4"
                className="overflow-auto"
              >
                <pre className="whitespace-pre-wrap font-mono text-sm m-0">
                  {sak.sensitivData}
                </pre>
              </Box>
            )}
          </VStack>
        </Box>

        {/* Tilganger */}
        <Box
          background="default"
          padding="space-20"
          borderRadius="8"
        >
          <VStack gap="space-16">
            <HStack justify="space-between" align="center">
              <HStack gap="space-8" align="center">
                <PersonGroupIcon aria-hidden />
                <Heading size="xsmall">Tilganger</Heading>
              </HStack>
              <Button
                variant="tertiary"
                size="small"
                icon={<PlusIcon aria-hidden />}
                onClick={() => setShowTilgangModal(true)}
              >
                Gi tilgang
              </Button>
            </HStack>

            {sak.tilganger.length === 0 ? (
              <BodyShort className="text-gray-500">
                Ingen har tilgang til denne saken ennå. Oppretteren ({sak.opprettetAv}) har alltid tilgang.
              </BodyShort>
            ) : (
              <Table size="small">
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>NAVident</Table.HeaderCell>
                    <Table.HeaderCell>Gitt av</Table.HeaderCell>
                    <Table.HeaderCell>Gitt tidspunkt</Table.HeaderCell>
                    <Table.HeaderCell />
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {sak.tilganger.map((tilgang) => (
                    <Table.Row key={tilgang.navIdent}>
                      <Table.DataCell>
                        <HStack gap="space-8" align="center">
                          <PersonIcon aria-hidden fontSize="1rem" />
                          {tilgang.navIdent}
                          {tilgang.navIdent === sak.opprettetAv && (
                            <Tag variant="neutral" size="xsmall">
                              Oppretter
                            </Tag>
                          )}
                        </HStack>
                      </Table.DataCell>
                      <Table.DataCell>{tilgang.gittAv}</Table.DataCell>
                      <Table.DataCell>
                        {formatDato(tilgang.gittTidspunkt)} kl. {formatTid(tilgang.gittTidspunkt)}
                      </Table.DataCell>
                      <Table.DataCell>
                        {tilgang.navIdent !== sak.opprettetAv && (
                          <Button
                            variant="tertiary-neutral"
                            size="xsmall"
                            icon={<TrashIcon aria-hidden />}
                            onClick={() => handleFjernTilgang(tilgang.navIdent)}
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
        </Box>

        {/* Filer */}
        <Box
          background="default"
          padding="space-20"
          borderRadius="8"
        >
          <VStack gap="space-16">
            <HStack gap="space-8" align="center">
              <FileTextIcon aria-hidden />
              <Heading size="xsmall">Filer</Heading>
            </HStack>
            <FileUploadZone
              sakId={id!}
              onFileUploaded={(fil) => setFiler((prev) => [fil, ...prev])}
            />
            <FileList
              filer={filer}
              sakId={id!}
              onFileDeleted={(filId) => setFiler((prev) => prev.filter((f) => f.id !== filId))}
            />
          </VStack>
        </Box>

        {/* Jira-lenke */}
        {sak.jiraIssueKey && (
          <Box
            background="accent-soft"
            padding="space-16"
            borderRadius="8"
          >
            <HStack justify="space-between" align="center">
              <VStack gap="space-4">
                <Detail className="text-gray-600">Koblet til Jira-sak</Detail>
                <BodyShort weight="semibold">{sak.jiraIssueKey}</BodyShort>
              </VStack>
              <Button
                as="a"
                href={`https://jira.adeo.no/browse/${sak.jiraIssueKey}`}
                target="_blank"
                rel="noopener noreferrer"
                variant="tertiary"
                size="small"
                icon={<ExternalLinkIcon aria-hidden />}
                iconPosition="right"
              >
                Åpne i Jira
              </Button>
            </HStack>
          </Box>
        )}
      </VStack>

      {/* Delete Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteConfirmed(false);
        }}
        header={{ heading: "Slett sak", closeButton: true }}
      >
        <Modal.Body>
          <VStack gap="space-16">
            <BodyShort>
              Er du sikker på at du vil slette saken{" "}
              <strong>{sak.jiraIssueKey ?? sak.id}</strong>? Dette kan ikke angres.
            </BodyShort>
            <ConfirmationPanel
              checked={deleteConfirmed}
              onChange={() => setDeleteConfirmed(!deleteConfirmed)}
              label="Ja, jeg forstår at saken blir permanent slettet"
            />
          </VStack>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="danger"
            onClick={handleSlett}
            disabled={!deleteConfirmed}
          >
            Slett sak
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setShowDeleteModal(false);
              setDeleteConfirmed(false);
            }}
          >
            Avbryt
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Tilgang Modal */}
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
              Gi en bruker tilgang til saken <strong>{sak.jiraIssueKey ?? sak.id}</strong>.
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
    </>
  );
};
