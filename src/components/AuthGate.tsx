import type { ReactNode } from "react";
import { InlineMessage, BodyShort, Button, VStack } from "@navikt/ds-react";
import type { useEmbedAuth } from "../auth/useEmbedAuth";
import { SensitivPanel } from "./SensitivPanel";

interface AuthGateProps {
  auth: ReturnType<typeof useEmbedAuth>;
  children: ReactNode;
}

export const AuthGate = ({ auth, children }: AuthGateProps) => {
  if (auth.status === "loading") {
    return null;
  }

  if (auth.status === "polling") {
    return (
      <SensitivPanel>
        <VStack gap="space-12" align="start">
          <BodyShort>Venter på innlogging... Fullfør innloggingen i fanen som åpnet seg.</BodyShort>
          <button
            type="button"
            onClick={auth.openLogin}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--ax-text-action)", textDecoration: "underline", fontSize: "14px" }}
          >
            Åpne innlogging på nytt
          </button>
        </VStack>
      </SensitivPanel>
    );
  }

  if (auth.status === "unauthenticated") {
    return (
      <SensitivPanel>
        <VStack gap="space-12" align="start">
          <BodyShort>
            Du må logge inn for å se sensitiv informasjon for denne saken.
          </BodyShort>
          <Button variant="primary" size="small" onClick={auth.openLogin}>
            Logg inn
          </Button>
        </VStack>
      </SensitivPanel>
    );
  }

  if (auth.status === "error") {
    return (
      <SensitivPanel>
        <VStack gap="space-12" align="start">
          <InlineMessage status="error" size="small" role="alert">{auth.error}</InlineMessage>
          <Button variant="primary" size="small" onClick={auth.openLogin}>
            Logg inn på nytt
          </Button>
        </VStack>
      </SensitivPanel>
    );
  }

  return <>{children}</>;
};
