import { useState, type ReactNode } from "react";
import { LocalAlert, Button, VStack, HStack, BodyShort, Textarea } from "@navikt/ds-react";
import { leseloggApi } from "../api/sakApi";
import { cacheLeselogg } from "../utils/leselogg";
import { SensitivPanel } from "./SensitivPanel";

interface LeseloggGateProps {
  sakId: string;
  tilgangerHeader: ReactNode;
  onGodkjent: () => void;
}

export const LeseloggGate = ({ sakId, tilgangerHeader, onGodkjent }: LeseloggGateProps) => {
  const [visBegrunnelse, setVisBegrunnelse] = useState(false);
  const [begrunnelse, setBegrunnelse] = useState("");
  const [begrunnelseLoading, setBegrunnelseLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <SensitivPanel>
      <div className="flex justify-end">{tilgangerHeader}</div>
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
              <LocalAlert status="error" size="small">
                <LocalAlert.Header>
                  <LocalAlert.Title as="div">{error}</LocalAlert.Title>
                  <LocalAlert.CloseButton onClick={() => setError(null)} />
                </LocalAlert.Header>
              </LocalAlert>
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
                  setBegrunnelseLoading(true);
                  try {
                    await leseloggApi.registrer(sakId, begrunnelse);
                    cacheLeselogg(sakId);
                    setBegrunnelse("");
                    onGodkjent();
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
    </SensitivPanel>
  );
};
