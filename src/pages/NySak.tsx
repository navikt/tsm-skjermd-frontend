import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Button,
  Alert,
  Heading,
  TextField,
  Textarea,
  HStack,
  VStack,
  Box,
  BodyShort,
  Detail,
  GuidePanel,
} from "@navikt/ds-react";
import {
  ArrowLeftIcon,
  FloppydiskIcon,
  PlusCircleIcon,
  InformationSquareIcon,
} from "@navikt/aksel-icons";
import { sakApi } from "../api/sakApi";

export const NySak = () => {
  const navigate = useNavigate();
  const [jiraIssueKey, setJiraIssueKey] = useState("");
  const [sensitivData, setSensitivData] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isValidJiraKey = (key: string) => {
    return /^[A-Z]+-\d+$/.test(key.trim());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sensitivData.trim()) {
      setError("Sensitiv informasjon må fylles ut");
      return;
    }

    if (jiraIssueKey.trim() && !isValidJiraKey(jiraIssueKey)) {
      setError("Ugyldig Jira-nøkkel format. Bruk formatet ABC-123");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const nySak = await sakApi.opprett({
        jiraIssueKey: jiraIssueKey.trim() ? jiraIssueKey.trim().toUpperCase() : undefined,
        sensitivData: sensitivData.trim(),
      });
      navigate(`/saker/${nySak.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke opprette sak");
    } finally {
      setSaving(false);
    }
  };

  return (
    <VStack gap="6">
      {/* Header */}
      <Box
        background="surface-default"
        padding="5"
        borderRadius="large"
        shadow="xsmall"
      >
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
            <PlusCircleIcon fontSize="1.5rem" className="text-blue-600" />
            <Heading size="large">Opprett ny sak</Heading>
          </HStack>
          <BodyShort className="text-gray-500">
            Opprett en ny skjermet sak. Kan kobles til en Jira-issue nå eller senere.
          </BodyShort>
        </VStack>
      </Box>

      {error && (
        <Alert variant="error" closeButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Info panel */}
      <GuidePanel>
        <VStack gap="2">
          <BodyShort weight="semibold">Om skjermede saker</BodyShort>
          <BodyShort>
            Sensitiv informasjon du legger inn her blir lagret sikkert og vil
            ikke være synlig i Jira. Du kan koble saken til en Jira-issue nå
            eller senere ved å redigere saken.
          </BodyShort>
        </VStack>
      </GuidePanel>

      {/* Form */}
      <Box
        as="form"
        onSubmit={handleSubmit}
        background="surface-default"
        padding="6"
        borderRadius="large"
        shadow="xsmall"
      >
        <VStack gap="6">
          <VStack gap="2">
            <TextField
              label="Jira-nøkkel (valgfritt)"
              description="Nøkkelen til Jira-saken som skal kobles til (f.eks. TSM-1234). Kan legges til senere."
              value={jiraIssueKey}
              onChange={(e) => setJiraIssueKey(e.target.value.toUpperCase())}
              error={
                jiraIssueKey && !isValidJiraKey(jiraIssueKey)
                  ? "Bruk formatet ABC-123"
                  : undefined
              }
            />
            {jiraIssueKey && isValidJiraKey(jiraIssueKey) && (
              <Detail className="text-green-600">
                Gyldig Jira-nøkkel format
              </Detail>
            )}
          </VStack>

          <Textarea
            label="Sensitiv informasjon"
            description="Informasjon som skal skjermes fra Jira. Dette kan inkludere personopplysninger, helseinformasjon, eller annen sensitiv data."
            value={sensitivData}
            onChange={(e) => setSensitivData(e.target.value)}
            rows={10}
            className="font-mono"
          />

          {sensitivData && (
            <Box
              background="surface-subtle"
              padding="3"
              borderRadius="medium"
            >
              <HStack gap="2" align="center">
                <InformationSquareIcon className="text-gray-500" />
                <Detail className="text-gray-600">
                  {sensitivData.length} tegn ·{" "}
                  {sensitivData.split("\n").length} linjer
                </Detail>
              </HStack>
            </Box>
          )}

          <HStack gap="3" className="pt-4 border-t border-gray-200">
            <Button
              type="submit"
              icon={<FloppydiskIcon aria-hidden />}
              loading={saving}
              disabled={!sensitivData.trim() || (!!jiraIssueKey.trim() && !isValidJiraKey(jiraIssueKey))}
            >
              Opprett sak
            </Button>
            <Button as={Link} to="/" variant="secondary">
              Avbryt
            </Button>
          </HStack>
        </VStack>
      </Box>
    </VStack>
  );
};
