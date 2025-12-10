import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Alert,
  Loader,
  Heading,
  HStack,
  VStack,
  Tag,
  Box,
  BodyShort,
  Detail,
  Search,
  Chips,
} from "@navikt/ds-react";
import {
  PlusIcon,
  TrashIcon,
  ChevronRightIcon,
  PersonIcon,
  ClockIcon,
  MagnifyingGlassIcon,
} from "@navikt/aksel-icons";
import { sakApi } from "../api/sakApi";
import type { Sak } from "../api/types";

export const SakerList = () => {
  const [saker, setSaker] = useState<Sak[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"alle" | "original" | "endret">("alle");

  const hentSaker = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await sakApi.hentAlle();
      setSaker(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke hente saker");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    hentSaker();
  }, []);

  const handleSlett = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Er du sikker på at du vil slette denne saken?")) return;
    try {
      await sakApi.slett(id);
      setSaker((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke slette sak");
    }
  };

  const formatDato = (dato: string) => {
    return new Date(dato).toLocaleDateString("nb-NO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTid = (dato: string) => {
    return new Date(dato).toLocaleTimeString("nb-NO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredSaker = saker.filter((sak) => {
    const matchesSearch =
      sak.jiraIssueKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sak.opprettetAv.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      filter === "alle" ||
      (filter === "endret" && sak.endretTidspunkt) ||
      (filter === "original" && !sak.endretTidspunkt);

    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-4">
        <Loader size="xlarge" title="Laster saker..." />
        <BodyShort className="text-gray-500">Henter skjermede saker...</BodyShort>
      </div>
    );
  }

  return (
    <VStack gap="6">
      <HStack justify="space-between" align="center" wrap gap="4">
        <VStack gap="1">
          <Heading size="large">Skjermede saker</Heading>
          <BodyShort className="text-gray-500">
            {saker.length} {saker.length === 1 ? "sak" : "saker"} totalt
          </BodyShort>
        </VStack>
        <Button
          as={Link}
          to="/saker/ny"
          icon={<PlusIcon aria-hidden />}
          variant="primary"
        >
          Ny sak
        </Button>
      </HStack>

      {error && (
        <Alert variant="error" closeButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box
        background="surface-subtle"
        padding="4"
        borderRadius="large"
      >
        <VStack gap="4">
          <Search
            label="Søk i saker"
            hideLabel
            placeholder="Søk på Jira-nøkkel eller opprettet av..."
            value={searchQuery}
            onChange={setSearchQuery}
            clearButton
          />
          <Chips>
            <Chips.Toggle
              selected={filter === "alle"}
              onClick={() => setFilter("alle")}
            >
              Alle ({saker.length})
            </Chips.Toggle>
            <Chips.Toggle
              selected={filter === "original"}
              onClick={() => setFilter("original")}
            >
              Originale ({saker.filter((s) => !s.endretTidspunkt).length})
            </Chips.Toggle>
            <Chips.Toggle
              selected={filter === "endret"}
              onClick={() => setFilter("endret")}
            >
              Endret ({saker.filter((s) => s.endretTidspunkt).length})
            </Chips.Toggle>
          </Chips>
        </VStack>
      </Box>

      {filteredSaker.length === 0 ? (
        <Box
          background="surface-subtle"
          padding="8"
          borderRadius="large"
          className="text-center"
        >
          <VStack gap="2" align="center">
            <MagnifyingGlassIcon
              className="text-gray-400"
              style={{ fontSize: "3rem" }}
            />
            <Heading size="small" className="text-gray-600">
              {saker.length === 0
                ? "Ingen saker funnet"
                : "Ingen saker matcher søket"}
            </Heading>
            <BodyShort className="text-gray-500">
              {saker.length === 0
                ? "Opprett en ny sak for å komme i gang"
                : "Prøv et annet søkeord eller filter"}
            </BodyShort>
          </VStack>
        </Box>
      ) : (
        <VStack gap="3">
          {filteredSaker.map((sak) => (
            <Link
              key={sak.id}
              to={`/saker/${sak.id}`}
              className="no-underline"
            >
              <Box
                background="surface-default"
                padding="4"
                borderRadius="large"
                shadow="xsmall"
                className="hover:shadow-medium transition-shadow cursor-pointer border border-transparent hover:border-blue-300"
              >
                <HStack justify="space-between" align="center" gap="4">
                  <VStack gap="2" className="flex-1">
                    <HStack gap="3" align="center">
                      <Heading size="small" className="text-blue-600">
                        {sak.jiraIssueKey}
                      </Heading>
                      {sak.endretTidspunkt ? (
                        <Tag variant="warning" size="xsmall">
                          Endret
                        </Tag>
                      ) : (
                        <Tag variant="success" size="xsmall">
                          Original
                        </Tag>
                      )}
                    </HStack>
                    <HStack gap="4" className="text-gray-500">
                      <HStack gap="1" align="center">
                        <PersonIcon aria-hidden fontSize="1rem" />
                        <Detail>{sak.opprettetAv}</Detail>
                      </HStack>
                      <HStack gap="1" align="center">
                        <ClockIcon aria-hidden fontSize="1rem" />
                        <Detail>
                          {formatDato(sak.opprettetTidspunkt)} kl.{" "}
                          {formatTid(sak.opprettetTidspunkt)}
                        </Detail>
                      </HStack>
                    </HStack>
                  </VStack>
                  <HStack gap="2" align="center">
                    <Button
                      variant="tertiary-neutral"
                      size="small"
                      icon={<TrashIcon aria-hidden />}
                      onClick={(e) => handleSlett(e, sak.id)}
                      title="Slett sak"
                    />
                    <ChevronRightIcon
                      className="text-gray-400"
                      fontSize="1.5rem"
                    />
                  </HStack>
                </HStack>
              </Box>
            </Link>
          ))}
        </VStack>
      )}
    </VStack>
  );
};
