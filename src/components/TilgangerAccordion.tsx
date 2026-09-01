import { useState, useRef, useCallback, useEffect } from "react";
import {
  Button,
  VStack,
  HStack,
  Table,
  Tag,
  Detail,
  BodyShort,
  Accordion,
  Tabs,
  Loader,
  UNSAFE_Combobox,
} from "@navikt/ds-react";
import { PersonIcon, PersonGroupIcon, TrashIcon } from "@navikt/aksel-icons";
import { brukerApi, gruppeApi, sakApi } from "../api/sakApi";
import type { AuditHendelse, BrukerSøkResult, Gruppe, Sak } from "../api/types";
import { formatDato, formatTid } from "../utils/format";

interface TilgangerAccordionProps {
  sakId: string;
  sak: Sak;
  setSak: React.Dispatch<React.SetStateAction<Sak | null>>;
  onError: (message: string) => void;
}

const gruppeTypeTekst: Record<string, string> = {
  TEAM: "Team",
  OMRAADE: "Område",
  PRODUKTOMRAADE: "Produktområde",
};

const handlingTekst: Record<AuditHendelse["handling"], string> = {
  TILGANG_GITT: "Tilgang gitt",
  TILGANG_FJERNET: "Tilgang fjernet",
  GRUPPETILGANG_GITT: "Gruppetilgang gitt",
  GRUPPETILGANG_FJERNET: "Gruppetilgang fjernet",
};

export const TilgangerAccordion = ({ sakId, sak, setSak, onError }: TilgangerAccordionProps) => {
  const [newNavIdent, setNewNavIdent] = useState("");
  const [selectedBrukerLabel, setSelectedBrukerLabel] = useState("");
  const [tilgangLoading, setTilgangLoading] = useState(false);
  const [brukerSøkResultater, setBrukerSøkResultater] = useState<BrukerSøkResult[]>([]);
  const [brukerSøkLoading, setBrukerSøkLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [valgtGruppe, setValgtGruppe] = useState<Gruppe | null>(null);
  const [gruppeTilgangLoading, setGruppeTilgangLoading] = useState(false);
  const [gruppeSøkResultater, setGruppeSøkResultater] = useState<Gruppe[]>([]);
  const [gruppeSøkLoading, setGruppeSøkLoading] = useState(false);
  const gruppeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [auditlogg, setAuditlogg] = useState<AuditHendelse[] | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [aktivFane, setAktivFane] = useState("personer");

  const gruppeTilganger = sak.gruppeTilganger ?? [];

  useEffect(() => {
    if (aktivFane !== "historikk" || auditlogg !== null || auditLoading) return;
    setAuditLoading(true);
    sakApi
      .hentAuditlogg(sakId)
      .then(setAuditlogg)
      .catch(() => setAuditlogg([]))
      .finally(() => setAuditLoading(false));
  }, [aktivFane, auditlogg, auditLoading, sakId]);

  const invaliderAuditlogg = () => setAuditlogg(null);

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
      invaliderAuditlogg();
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

  const handleGruppeSøk = useCallback((query: string) => {
    if (gruppeDebounceRef.current) clearTimeout(gruppeDebounceRef.current);
    if (query.length < 2) {
      setGruppeSøkResultater([]);
      return;
    }
    gruppeDebounceRef.current = setTimeout(async () => {
      setGruppeSøkLoading(true);
      try {
        const resultater = await gruppeApi.søk(query);
        setGruppeSøkResultater(resultater);
      } catch {
        setGruppeSøkResultater([]);
      } finally {
        setGruppeSøkLoading(false);
      }
    }, 300);
  }, []);

  const handleFjernTilgang = async (navIdent: string) => {
    try {
      await sakApi.fjernTilgang(sakId, navIdent);
      setSak((prev) =>
        prev
          ? {
              ...prev,
              tilganger: prev.tilganger.filter(
                (t) => !(t.navIdent === navIdent && t.kilde !== "GRUPPE")
              ),
            }
          : prev
      );
      invaliderAuditlogg();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Kunne ikke fjerne tilgang");
    }
  };

  const handleGiGruppeTilgang = async () => {
    if (!valgtGruppe) return;
    try {
      setGruppeTilgangLoading(true);
      const respons = await sakApi.giGruppeTilgang(sakId, { gruppeId: valgtGruppe.id });
      setSak((prev) =>
        prev
          ? {
              ...prev,
              tilganger: respons.tilganger,
              gruppeTilganger: [...(prev.gruppeTilganger ?? []), respons.gruppeTilgang],
            }
          : prev
      );
      setValgtGruppe(null);
      setGruppeSøkResultater([]);
      invaliderAuditlogg();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Kunne ikke gi tilgang til gruppen");
    } finally {
      setGruppeTilgangLoading(false);
    }
  };

  const handleFjernGruppeTilgang = async (gruppeId: string) => {
    try {
      await sakApi.fjernGruppeTilgang(sakId, gruppeId);
      setSak((prev) =>
        prev
          ? {
              ...prev,
              tilganger: prev.tilganger.filter((t) => t.gruppeId !== gruppeId),
              gruppeTilganger: (prev.gruppeTilganger ?? []).filter((g) => g.gruppeId !== gruppeId),
            }
          : prev
      );
      invaliderAuditlogg();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Kunne ikke fjerne gruppetilgangen");
    }
  };

  return (
    <div className="mb-4">
      <Accordion className="accordion-borderless">
        <Accordion.Item>
          <div className="flex justify-end">
            <Accordion.Header style={{ width: "auto" }}>
              <HStack gap="space-8" align="center">
                <BodyShort size="small" weight="semibold">Tilganger</BodyShort>
                <Tag variant="neutral" size="xsmall">{sak.tilganger.length}</Tag>
                {gruppeTilganger.length > 0 && (
                  <Tag variant="alt3" size="xsmall">{gruppeTilganger.length} grupper</Tag>
                )}
              </HStack>
            </Accordion.Header>
          </div>
          <Accordion.Content>
            <Tabs value={aktivFane} onChange={setAktivFane} size="small">
              <Tabs.List>
                <Tabs.Tab value="personer" label="Personer" icon={<PersonIcon aria-hidden />} />
                <Tabs.Tab value="grupper" label="Grupper" icon={<PersonGroupIcon aria-hidden />} />
                <Tabs.Tab value="historikk" label="Historikk" />
              </Tabs.List>

              <Tabs.Panel value="personer">
                <VStack gap="space-8" className="pt-4">
                  {sak.tilganger.length === 0 ? (
                    <Detail className="text-gray-500">
                      Ingen har tilgang ennå. Oppretteren ({sak.opprettetAv}) har alltid tilgang.
                    </Detail>
                  ) : (
                    <Table size="small">
                      <Table.Header>
                        <Table.Row>
                          <Table.HeaderCell>NAVident</Table.HeaderCell>
                          <Table.HeaderCell>Kilde</Table.HeaderCell>
                          <Table.HeaderCell>Gitt av</Table.HeaderCell>
                          <Table.HeaderCell>Tidspunkt</Table.HeaderCell>
                          <Table.HeaderCell />
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {sak.tilganger.map((t) => {
                          const fraGruppe = t.kilde === "GRUPPE" && !!t.gruppeId;
                          return (
                            <Table.Row key={`${t.navIdent}-${t.gruppeId ?? "direkte"}`}>
                              <Table.DataCell>
                                <HStack gap="space-4" align="center">
                                  <PersonIcon aria-hidden fontSize="1rem" />
                                  {t.navIdent}
                                  {t.navIdent === sak.opprettetAv && (
                                    <Tag variant="neutral" size="xsmall">Oppretter</Tag>
                                  )}
                                </HStack>
                              </Table.DataCell>
                              <Table.DataCell>
                                {fraGruppe ? (
                                  <Tag variant="alt3" size="xsmall">
                                    Via {t.gruppeNavn ?? t.gruppeId}
                                  </Tag>
                                ) : (
                                  <Tag variant="info" size="xsmall">Direkte</Tag>
                                )}
                              </Table.DataCell>
                              <Table.DataCell>{t.gittAv}</Table.DataCell>
                              <Table.DataCell>
                                {formatDato(t.gittTidspunkt)} kl. {formatTid(t.gittTidspunkt)}
                              </Table.DataCell>
                              <Table.DataCell>
                                {t.navIdent !== sak.opprettetAv && !fraGruppe && (
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
                          );
                        })}
                      </Table.Body>
                    </Table>
                  )}
                  <Detail className="text-gray-500">
                    Oppretteren ({sak.opprettetAv}) har alltid tilgang og kan ikke fjernes.
                    Tilganger som kommer fra en gruppe fjernes under fanen «Grupper».
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
                        setSelectedBrukerLabel(
                          match ? `${match.displayName} (${match.navIdent})` : value
                        );
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
              </Tabs.Panel>

              <Tabs.Panel value="grupper">
                <VStack gap="space-8" className="pt-4">
                  {gruppeTilganger.length === 0 ? (
                    <Detail className="text-gray-500">Ingen grupper har fått tilgang ennå.</Detail>
                  ) : (
                    <Table size="small">
                      <Table.Header>
                        <Table.Row>
                          <Table.HeaderCell>Gruppe</Table.HeaderCell>
                          <Table.HeaderCell>Medlemmer ved tildeling</Table.HeaderCell>
                          <Table.HeaderCell>Gitt av</Table.HeaderCell>
                          <Table.HeaderCell>Tidspunkt</Table.HeaderCell>
                          <Table.HeaderCell />
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {gruppeTilganger.map((g) => (
                          <Table.Row key={g.gruppeId}>
                            <Table.DataCell>
                              <HStack gap="space-4" align="center">
                                <PersonGroupIcon aria-hidden fontSize="1rem" />
                                {g.gruppeNavn}
                                {g.gruppeType && (
                                  <Tag variant="neutral" size="xsmall">
                                    {gruppeTypeTekst[g.gruppeType] ?? g.gruppeType}
                                  </Tag>
                                )}
                              </HStack>
                            </Table.DataCell>
                            <Table.DataCell>{g.medlemmer.length}</Table.DataCell>
                            <Table.DataCell>{g.gittAv}</Table.DataCell>
                            <Table.DataCell>
                              {formatDato(g.gittTidspunkt)} kl. {formatTid(g.gittTidspunkt)}
                            </Table.DataCell>
                            <Table.DataCell>
                              <Button
                                variant="tertiary-neutral"
                                size="xsmall"
                                icon={<TrashIcon aria-hidden />}
                                onClick={() => handleFjernGruppeTilgang(g.gruppeId)}
                                title="Fjern gruppetilgang"
                              />
                            </Table.DataCell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table>
                  )}
                  <Detail className="text-gray-500">
                    Grupper hentes fra Teamkatalogen. Når en gruppe får tilgang, tildeles tilgangen
                    til personene som er medlem på tildelingstidspunktet. Nye medlemmer i gruppen får
                    ikke tilgang automatisk.
                  </Detail>
                  <UNSAFE_Combobox
                    label="Gi tilgang til gruppe"
                    description="Søk etter team eller område i Teamkatalogen"
                    options={[]}
                    filteredOptions={gruppeSøkResultater.map((g) => ({
                      label: `${g.navn} (${g.antallMedlemmer} medlemmer)`,
                      value: g.id,
                    }))}
                    isLoading={gruppeSøkLoading}
                    onChange={handleGruppeSøk}
                    onToggleSelected={(value, isSelected) => {
                      if (isSelected) {
                        setValgtGruppe(gruppeSøkResultater.find((g) => g.id === value) ?? null);
                      } else {
                        setValgtGruppe(null);
                      }
                    }}
                    shouldAutocomplete={false}
                  />
                  <Button
                    size="small"
                    onClick={handleGiGruppeTilgang}
                    loading={gruppeTilgangLoading}
                    disabled={!valgtGruppe}
                  >
                    {valgtGruppe
                      ? `Gi tilgang til ${valgtGruppe.navn} (${valgtGruppe.antallMedlemmer} medlemmer)`
                      : "Gi tilgang til gruppe"}
                  </Button>
                </VStack>
              </Tabs.Panel>

              <Tabs.Panel value="historikk">
                <VStack gap="space-8" className="pt-4">
                  {auditLoading && <Loader size="small" title="Henter historikk" />}
                  {!auditLoading && auditlogg && auditlogg.length === 0 && (
                    <Detail className="text-gray-500">Ingen registrerte tilgangsendringer.</Detail>
                  )}
                  {!auditLoading && auditlogg && auditlogg.length > 0 && (
                    <Table size="small">
                      <Table.Header>
                        <Table.Row>
                          <Table.HeaderCell>Tidspunkt</Table.HeaderCell>
                          <Table.HeaderCell>Handling</Table.HeaderCell>
                          <Table.HeaderCell>Gjelder</Table.HeaderCell>
                          <Table.HeaderCell>Utført av</Table.HeaderCell>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {auditlogg.map((h) => (
                          <Table.Row key={h.id}>
                            <Table.DataCell>
                              {formatDato(h.tidspunkt)} kl. {formatTid(h.tidspunkt)}
                            </Table.DataCell>
                            <Table.DataCell>{handlingTekst[h.handling] ?? h.handling}</Table.DataCell>
                            <Table.DataCell>
                              {h.gruppeNavn
                                ? `${h.gruppeNavn}${h.antallBerorte !== null ? ` (${h.antallBerorte} personer)` : ""}`
                                : (h.navIdent ?? "-")}
                            </Table.DataCell>
                            <Table.DataCell>{h.utfoertAv}</Table.DataCell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table>
                  )}
                  <Detail className="text-gray-500">
                    Alle tildelinger og fjerninger av tilgang auditlogges i tsm-skjermd.
                  </Detail>
                </VStack>
              </Tabs.Panel>
            </Tabs>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion>
    </div>
  );
};
