import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { Alert, Button, VStack, BodyShort } from "@navikt/ds-react";
import { kommentarApi, filApi, sakApi, setEmbedTokenProvider } from "../api/sakApi";
import type { FilInfo, Kommentar, Sak } from "../api/types";
import { useEmbedAuth } from "../auth/useEmbedAuth";
import { useIframeHeightSync } from "../hooks/useIframeHeightSync";
import { erLeseloggCachet } from "../utils/leselogg";
import { SensitivPanel } from "../components/SensitivPanel";
import { AuthGate } from "../components/AuthGate";
import { TilgangerAccordion } from "../components/TilgangerAccordion";
import { LeseloggGate } from "../components/LeseloggGate";
import { BeskrivelseSeksjon } from "../components/BeskrivelseSeksjon";
import { KommentarSeksjon } from "../components/KommentarSeksjon";
import { FilerSeksjon } from "../components/FilerSeksjon";

export const SakIframe = () => {
  const { sakId } = useParams<{ sakId: string }>();
  const auth = useEmbedAuth();
  const [sak, setSak] = useState<Sak | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kommentarer, setKommentarer] = useState<Kommentar[]>([]);
  const [kommentarerLoading, setKommentarerLoading] = useState(false);
  const [visningGodkjent, setVisningGodkjent] = useState(() => !!sakId && erLeseloggCachet(sakId));
  const [filer, setFiler] = useState<FilInfo[]>([]);
  const [tilgang, setTilgang] = useState<"loading" | "ok" | "denied">("loading");

  useIframeHeightSync();

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    setEmbedTokenProvider(auth.getAccessToken);
    setTilgang("ok");
  }, [auth.status, auth.getAccessToken]);

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
        setError("Kunne ikke hente sak");
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
      })
      .finally(() => {
        setKommentarerLoading(false);
      });

    filApi
      .hentAlle(sakId)
      .then(setFiler)
      .catch(() => {});
  }, [tilgang, sakId]);

  if (!sakId) {
    return <p>Mangler sakId</p>;
  }

  return (
    <AuthGate auth={auth}>
      {tilgang === "loading" ? null : tilgang === "denied" ? (
        <SensitivPanel>
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
        </SensitivPanel>
      ) : !visningGodkjent ? (
        <LeseloggGate
          sakId={sakId}
          tilgangerHeader={
            sak && (
              <TilgangerAccordion sakId={sakId} sak={sak} setSak={setSak} onError={setError} />
            )
          }
          onGodkjent={() => setVisningGodkjent(true)}
        />
      ) : (
        <SensitivPanel background={false}>
          {sak && (
            <TilgangerAccordion sakId={sakId} sak={sak} setSak={setSak} onError={setError} />
          )}

          <VStack gap="space-12">
            {error && (
              <Alert variant="error" size="small" closeButton onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <BeskrivelseSeksjon
              sakId={sakId}
              sak={sak}
              getAccessToken={auth.getAccessToken}
              onError={setError}
            />

            <KommentarSeksjon
              sakId={sakId}
              sak={sak}
              kommentarer={kommentarer}
              setKommentarer={setKommentarer}
              kommentarerLoading={kommentarerLoading}
              onError={setError}
            />

            <FilerSeksjon sakId={sakId} filer={filer} setFiler={setFiler} />
          </VStack>
        </SensitivPanel>
      )}
    </AuthGate>
  );
};
