import { useState, useRef, useCallback } from "react";
import {
  Button,
  VStack,
  HStack,
  Table,
  Tag,
  Detail,
  BodyShort,
  Accordion,
  UNSAFE_Combobox,
} from "@navikt/ds-react";
import { PersonIcon, TrashIcon } from "@navikt/aksel-icons";
import { brukerApi, sakApi } from "../api/sakApi";
import type { BrukerSøkResult, Sak } from "../api/types";
import { formatDato, formatTid } from "../utils/format";

interface TilgangerAccordionProps {
  sakId: string;
  sak: Sak;
  setSak: React.Dispatch<React.SetStateAction<Sak | null>>;
  onError: (message: string) => void;
}

export const TilgangerAccordion = ({ sakId, sak, setSak, onError }: TilgangerAccordionProps) => {
  const [newNavIdent, setNewNavIdent] = useState("");
  const [selectedBrukerLabel, setSelectedBrukerLabel] = useState("");
  const [tilgangLoading, setTilgangLoading] = useState(false);
  const [brukerSøkResultater, setBrukerSøkResultater] = useState<BrukerSøkResult[]>([]);
  const [brukerSøkLoading, setBrukerSøkLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleGiTilgang = async () => {
    if (!newNavIdent.trim()) return;
    try {
      setTilgangLoading(true);
      const nyTilgang = await sakApi.giTilgang(sakId, {
        navIdent: newNavIdent.trim().toUpperCase(),
      });
      setSak((prev) =>
        prev ? { ...prev, tilganger: [...prev.tilganger, nyTilgang] } : prev
      );
      setNewNavIdent("");
      setSelectedBrukerLabel("");
      setBrukerSøkResultater([]);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Kunne ikke gi tilgang");
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
    try {
      await sakApi.fjernTilgang(sakId, navIdent);
      setSak((prev) =>
        prev
          ? { ...prev, tilganger: prev.tilganger.filter((t) => t.navIdent !== navIdent) }
          : prev
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Kunne ikke fjerne tilgang");
    }
  };

  return (
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
                  if (isSelected) {
                    setNewNavIdent(value);
                    const match = brukerSøkResultater.find((b) => b.navIdent === value);
                    setSelectedBrukerLabel(match ? `${match.displayName} (${match.navIdent})` : value);
                  } else {
                    setNewNavIdent("");
                    setSelectedBrukerLabel("");
                  }
                }}
                shouldAutocomplete={false}
              />
              <Button
                size="small"
                onClick={handleGiTilgang}
                loading={tilgangLoading}
                disabled={!newNavIdent.trim()}
              >
                {selectedBrukerLabel ? `Gi tilgang til ${selectedBrukerLabel}` : "Gi tilgang"}
              </Button>
            </VStack>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion>
    </div>
  );
};
