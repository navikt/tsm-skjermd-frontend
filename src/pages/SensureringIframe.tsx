import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader, BodyShort, Alert, VStack } from "@navikt/ds-react";
import { SensureringEditor } from "../components/SensureringEditor";
import { initIframeAuth, cleanupIframeAuth, waitForToken } from "../api/iframeAuth";

export const SensureringIframe = () => {
  const { sakId } = useParams<{ sakId: string }>();
  const [tokenReady, setTokenReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initIframeAuth();

    const timeout = setTimeout(() => {
      setError("Tidsavbrudd: Mottok ikke autentiseringstoken fra foreldresiden.");
    }, 10000);

    waitForToken().then(() => {
      clearTimeout(timeout);
      setTokenReady(true);
    });

    return () => {
      clearTimeout(timeout);
      cleanupIframeAuth();
    };
  }, []);

  if (!sakId) {
    return <p>Mangler sakId</p>;
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="error">{error}</Alert>
      </div>
    );
  }

  if (!tokenReady) {
    return (
      <div className="p-4">
        <VStack gap="2" align="center">
          <Loader size="large" />
          <BodyShort>Venter på autentisering...</BodyShort>
        </VStack>
      </div>
    );
  }

  return (
    <div className="p-4">
      <SensureringEditor sakId={sakId} autoSave />
    </div>
  );
};
