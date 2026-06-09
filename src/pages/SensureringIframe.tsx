import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { InlineMessage, BodyShort, Button, Heading, Link, VStack } from "@navikt/ds-react";
import { XMarkIcon } from "@navikt/aksel-icons";
import { SensureringEditor } from "../components/SensureringEditor";
import { FileUploadZone } from "../components/FileUploadZone";
import { FileList } from "../components/FileList";
import { filApi, setEmbedTokenProvider } from "../api/sakApi";
import type { FilInfo } from "../api/types";
import { useEmbedAuth } from "../auth/useEmbedAuth";

export const SensureringIframe = () => {
  const { sakId } = useParams<{ sakId: string }>();
  const auth = useEmbedAuth();
  const [tilgang, setTilgang] = useState<"loading" | "ok" | "denied">("loading");
  const [visInfo, setVisInfo] = useState(false);
  const [filer, setFiler] = useState<FilInfo[]>([]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    setEmbedTokenProvider(auth.getAccessToken);
    setTilgang("ok");
    if (sakId) {
      filApi.hentAlle(sakId).then(setFiler).catch(() => {});
    }
  }, [auth.status, auth.getAccessToken, sakId]);

  if (!sakId) {
    return <p>Mangler sakId</p>;
  }

  if (auth.status === "loading") {
    return null;
  }

  if (auth.status === "polling") {
    return (
      <div className="p-4" style={{ backgroundColor: "var(--ax-bg-danger-soft)" }}>
        <VStack gap="space-12" align="start">
          <BodyShort>Venter på innlogging... Fullfør innloggingen i fanen som åpnet seg.</BodyShort>
          {auth.loginUrl && (
            <a href={auth.loginUrl} target="_blank" rel="opener noopener" onClick={auth.openLogin} style={{ color: "var(--ax-text-action)", textDecoration: "underline", fontSize: "14px" }}>
              Åpne innlogging på nytt
            </a>
          )}
        </VStack>
      </div>
    );
  }

  if (auth.status === "unauthenticated") {
    return (
      <div className="p-4" style={{ backgroundColor: "var(--ax-bg-danger-soft)" }}>
        <VStack gap="space-12" align="start">
          <BodyShort>Du må logge inn for å bruke sensureringseditoren.</BodyShort>
          {auth.loginUrl && (
            <a href={auth.loginUrl} target="_blank" rel="opener noopener" onClick={auth.openLogin} className="navds-button navds-button--primary navds-button--small">
              Logg inn
            </a>
          )}
        </VStack>
      </div>
    );
  }

  if (tilgang === "loading") {
    return null;
  }

  if (auth.status === "error") {
    return (
      <div className="p-4" style={{ backgroundColor: "var(--ax-bg-danger-soft)" }}>
        <VStack gap="space-12" align="start">
          <InlineMessage status="error" size="small" role="alert">{auth.error}</InlineMessage>
          {auth.loginUrl && (
            <a href={auth.loginUrl} target="_blank" rel="opener noopener" onClick={auth.openLogin} className="navds-button navds-button--primary navds-button--small">
              Logg inn på nytt
            </a>
          )}
        </VStack>
      </div>
    );
  }

  if (tilgang === "denied") {
    return (
      <div className="p-4" style={{ backgroundColor: "var(--ax-bg-danger-soft)" }}>
        <InlineMessage status="warning" role="alert">Ingen tilgang</InlineMessage>
      </div>
    );
  }

  if (visInfo) {
    return (
      <div
        className="p-4 cursor-pointer relative"
        style={{ backgroundColor: "var(--ax-bg-danger-soft)" }}
        onClick={() => setVisInfo(false)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
            setVisInfo(false);
          }
        }}
      >
        <Button
          variant="tertiary-neutral"
          size="small"
          icon={<XMarkIcon aria-hidden />}
          onClick={(e) => {
            e.stopPropagation();
            setVisInfo(false);
          }}
          title="Lukk"
          className="!absolute top-2 right-2"
        />
        <VStack gap="space-12" align="start">
          <Heading level="2" size="small">Slik bruker du sensureringseditoren</Heading>
          <BodyShort size="small">
            Skriv eller lim inn teksten du vil registrere i editoren. Marker de delene av
            teksten som inneholder sensitiv informasjon — de blir automatisk sladdet og
            erstattet med stjerner i samme lengde som den opprinnelige teksten.
          </BodyShort>
          <BodyShort size="small">
            Hold musen over et sladdet felt for å fjerne sladdingen. Endringer lagres
            automatisk.
          </BodyShort>
          <BodyShort size="small" weight="semibold">Eksempel</BodyShort>
          <BodyShort size="small">
            Original tekst:
          </BodyShort>
          <div className="p-2 rounded bg-white font-mono text-sm w-full">
            Pasient Ola Nordmann (fnr 12345678901) har fått diagnose.
          </div>
          <BodyShort size="small">
            Etter sensurering av navn og fødselsnummer:
          </BodyShort>
          <div className="p-2 rounded bg-white font-mono text-sm w-full">
            Pasient{" "}
            <span className="sensurert-span">***********</span>
            {" "}(fnr{" "}
            <span className="sensurert-span">***********</span>
            ) har fått diagnose.
          </div>
          <BodyShort size="small" className="italic text-gray-600">
            Klikk hvor som helst for å lukke.
          </BodyShort>
        </VStack>
      </div>
    );
  }

  return (
    <div className="p-2" style={{ backgroundColor: "var(--ax-bg-danger-soft)" }}>
      <div className="flex justify-end mb-2 pr-2">
        <Link
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setVisInfo(true);
          }}
        >
          Veiledning
        </Link>
      </div>
      <SensureringEditor
        sakId={sakId}
        autoSave
        onAuthError={() => setTilgang("denied")}
      />
      <div className="mt-4">
        <BodyShort size="small" weight="semibold" className="mb-2">Filer</BodyShort>
        <FileUploadZone
          sakId={sakId}
          onFileUploaded={(fil) => setFiler((prev) => [fil, ...prev])}
        />
        <div className="mt-2">
          <FileList
            filer={filer}
            sakId={sakId}
            onFileDeleted={(filId) => setFiler((prev) => prev.filter((f) => f.id !== filId))}
          />
        </div>
      </div>
    </div>
  );
};
