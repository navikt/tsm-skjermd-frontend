import type { ReactNode } from "react";
import { InlineMessage, BodyShort, VStack } from "@navikt/ds-react";
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
          {auth.loginUrl && (
            <a href={auth.loginUrl} target="_blank" rel="opener noopener" onClick={auth.onLoginClick} style={{ color: "var(--ax-text-action)", textDecoration: "underline", fontSize: "14px" }}>
              Åpne innlogging på nytt
            </a>
          )}
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
          {auth.loginUrl && (
            <a href={auth.loginUrl} target="_blank" rel="opener noopener" onClick={auth.onLoginClick} className="navds-button navds-button--primary navds-button--small">
              Logg inn
            </a>
          )}
        </VStack>
      </SensitivPanel>
    );
  }

  if (auth.status === "error") {
    return (
      <SensitivPanel>
        <VStack gap="space-12" align="start">
          <InlineMessage status="error" size="small" role="alert">{auth.error}</InlineMessage>
          {auth.loginUrl && (
            <a href={auth.loginUrl} target="_blank" rel="opener noopener" onClick={auth.onLoginClick} className="navds-button navds-button--primary navds-button--small">
              Logg inn på nytt
            </a>
          )}
        </VStack>
      </SensitivPanel>
    );
  }

  return <>{children}</>;
};
