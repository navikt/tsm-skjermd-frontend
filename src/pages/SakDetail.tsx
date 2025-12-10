import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Button,
  Alert,
  Loader,
  Heading,
  Textarea,
  HStack,
  VStack,
  BodyShort,
  Box,
  Tag,
  Detail,
  CopyButton,
  Modal,
  ConfirmationPanel,
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
} from "@navikt/aksel-icons";
import { sakApi } from "../api/sakApi";
import type { Sak } from "../api/types";

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

  useEffect(() => {
    const hentSak = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const data = await sakApi.hentPaId(id);
        setSak(data);
        setSensitivData(data.sensitivData);
      } catch (err) {
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
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke slette sak");
    }
  };

  const handleCancel = () => {
    if (sak) setSensitivData(sak.sensitivData);
    setEditing(false);
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
        background="surface-subtle"
        padding="8"
        borderRadius="large"
        className="text-center"
      >
        <VStack gap="4" align="center">
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
      <VStack gap="6">
        {/* Header */}
        <Box
          background="surface-default"
          padding="5"
          borderRadius="large"
          shadow="xsmall"
        >
          <HStack justify="space-between" align="start" wrap gap="4">
            <VStack gap="3">
              <HStack gap="2" align="center">
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
              <HStack gap="3" align="center">
                <Heading size="large">{sak.jiraIssueKey}</Heading>
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
              <HStack gap="1" align="center" className="text-gray-500">
                <Detail>ID: {sak.id}</Detail>
                <CopyButton
                  size="xsmall"
                  copyText={sak.id}
                  title="Kopier ID"
                />
              </HStack>
            </VStack>
            <HStack gap="2">
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
          background="surface-subtle"
          padding="5"
          borderRadius="large"
        >
          <VStack gap="4">
            <Heading size="xsmall" className="text-gray-600">
              Saksinformasjon
            </Heading>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <VStack gap="1">
                <HStack gap="1" align="center" className="text-gray-500">
                  <PersonIcon aria-hidden fontSize="1rem" />
                  <Detail>Opprettet av</Detail>
                </HStack>
                <BodyShort weight="semibold">{sak.opprettetAv}</BodyShort>
              </VStack>
              <VStack gap="1">
                <HStack gap="1" align="center" className="text-gray-500">
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
              <VStack gap="1">
                <HStack gap="1" align="center" className="text-gray-500">
                  <PersonIcon aria-hidden fontSize="1rem" />
                  <Detail>Endret av</Detail>
                </HStack>
                <BodyShort weight="semibold">
                  {sak.endretAv || "-"}
                </BodyShort>
              </VStack>
              <VStack gap="1">
                <HStack gap="1" align="center" className="text-gray-500">
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
          background="surface-default"
          padding="5"
          borderRadius="large"
          shadow="xsmall"
        >
          <VStack gap="4">
            <HStack justify="space-between" align="center">
              <HStack gap="2" align="center">
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
              <VStack gap="4">
                <Textarea
                  label="Sensitiv informasjon"
                  hideLabel
                  value={sensitivData}
                  onChange={(e) => setSensitivData(e.target.value)}
                  rows={12}
                  className="font-mono"
                />
                <HStack gap="2">
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
                background="surface-subtle"
                padding="4"
                borderRadius="medium"
                className="overflow-auto"
              >
                <pre className="whitespace-pre-wrap font-mono text-sm m-0">
                  {sak.sensitivData}
                </pre>
              </Box>
            )}
          </VStack>
        </Box>

        {/* Jira-lenke */}
        <Box
          background="surface-action-subtle"
          padding="4"
          borderRadius="large"
        >
          <HStack justify="space-between" align="center">
            <VStack gap="1">
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
          <VStack gap="4">
            <BodyShort>
              Er du sikker på at du vil slette saken{" "}
              <strong>{sak.jiraIssueKey}</strong>? Dette kan ikke angres.
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
    </>
  );
};
