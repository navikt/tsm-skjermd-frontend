import type { ReactNode } from "react";
import { Alert, BodyShort, VStack } from "@navikt/ds-react";
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
          <button
            type="button"
            onClick={auth.openLogin}
            className="navds-button navds-button--primary navds-button--small"
          >
            Logg inn
          </button>
        </VStack>
      </SensitivPanel>
    );
  }

  if (auth.status === "error") {
    return (
      <SensitivPanel>
        <VStack gap="space-12" align="start">
          <Alert variant="error" size="small">{auth.error}</Alert>
          <button
            type="button"
            onClick={auth.openLogin}
            className="navds-button navds-button--primary navds-button--small"
          >
            Logg inn på nytt
          </button>
        </VStack>
      </SensitivPanel>
    );
  }

  return <>{children}</>;
};
