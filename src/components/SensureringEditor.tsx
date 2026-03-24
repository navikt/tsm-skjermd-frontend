import { useState, useRef, useCallback, useEffect } from "react";
import {
  Button,
  Box,
  VStack,
  HStack,
  Alert,
  Tag,
  Heading,
  BodyShort,
  Loader,
} from "@navikt/ds-react";
import {
  FloppydiskIcon,
  FileTextIcon,
  XMarkIcon,
} from "@navikt/aksel-icons";
import { sensureringApi } from "../api/sakApi";
import type { SensurertElement } from "../api/types";
import { createLogger } from "../logger";

const log = createLogger("Sensurering");

type SensurertItem = SensurertElement & { id: string };

interface SensureringEditorProps {
  sakId: string;
  onLagreOgLukk?: () => void;
  onAuthError?: () => void;
  autoSave?: boolean;
  readOnly?: boolean;
}

export const SensureringEditor = ({ sakId, onLagreOgLukk, onAuthError, autoSave = false, readOnly = false }: SensureringEditorProps) => {
  const [sensurertListe, setSensurertListe] = useState<SensurertItem[]>([]);
  const [originaltekst, setOriginaltekst] = useState("");
  const [lagrer, setLagrer] = useState(false);
  const [laster, setLaster] = useState(true);
  const [lagreStatus, setLagreStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const editableRef = useRef<HTMLDivElement>(null);
  const nextPlaceholderIndex = useRef(0);

  const genererPlaceholder = () => {
    nextPlaceholderIndex.current += 1;
    return `[SLADDET-${nextPlaceholderIndex.current}]`;
  };

  useEffect(() => {
    if (!sakId) return;
    setLaster(true);
    sensureringApi
      .hent(sakId)
      .then((data) => {
        setOriginaltekst(data.originaltekst);
        const liste = data.sensurertElementer.map((el, i) => ({
          original: el.original,
          placeholder: el.placeholder,
          id: `loaded-${i}`,
        }));
        setSensurertListe(liste);
        nextPlaceholderIndex.current = liste.length;

        if (editableRef.current) {
          let html = data.sensurertTekst;
          liste.forEach((item) => {
            html = html.replace(
              item.placeholder,
              `<span class="bg-gray-900 text-white px-1 rounded font-mono" data-sensurert-id="${item.id}">${item.placeholder}</span>`
            );
          });
          editableRef.current.innerHTML = html;
        }
      })
      .catch((err) => {
        log.warn(`Ingen eksisterende sensurering for sak ${sakId}`, err);
        if (err.message?.includes('401') || err.message?.includes('Embed-token')) {
          onAuthError?.();
        }
      })
      .finally(() => setLaster(false));
  }, [sakId]);

  const markerSomSensitiv = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.toString().trim() === "") {
      return;
    }

    const selectedText = selection.toString();
    const range = selection.getRangeAt(0);

    if (!editableRef.current?.contains(range.commonAncestorContainer)) {
      return;
    }

    if (sensurertListe.length === 0) {
      setOriginaltekst(editableRef.current?.innerText || "");
    }

    const nyId = crypto.randomUUID();
    const placeholder = genererPlaceholder();

    const span = document.createElement("span");
    span.className = "bg-gray-900 text-white px-1 rounded font-mono";
    span.dataset.sensurertId = nyId;
    span.textContent = placeholder;

    range.deleteContents();
    range.insertNode(span);
    selection.removeAllRanges();

    setSensurertListe((prev) => [
      ...prev,
      { original: selectedText, placeholder, id: nyId },
    ]);
  }, [sensurertListe]);

  useEffect(() => {
    const el = editableRef.current;
    if (!el || readOnly) return;

    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim() !== "") {
        markerSomSensitiv();
      }
    };

    el.addEventListener("mouseup", handleMouseUp);
    return () => el.removeEventListener("mouseup", handleMouseUp);
  }, [markerSomSensitiv, readOnly]);

  const fjernSensurering = useCallback((itemId: string) => {
    const item = sensurertListe.find((s) => s.id === itemId);
    if (!item || !editableRef.current) return;

    const span = editableRef.current.querySelector(`[data-sensurert-id="${itemId}"]`);
    if (span) {
      const textNode = document.createTextNode(item.original);
      span.replaceWith(textNode);
    }

    setSensurertListe((prev) => prev.filter((s) => s.id !== itemId));
  }, [sensurertListe]);

  const lagreSensurering = useCallback(async () => {
    if (!sakId) return;
    setLagrer(true);
    setLagreStatus(null);
    try {
      const sensurertTekst = editableRef.current?.innerText || "";
      await sensureringApi.lagre(sakId, {
        originaltekst,
        sensurertTekst,
        sensurertElementer: sensurertListe.map(({ placeholder, original }) => ({
          placeholder,
          original,
        })),
      });
      log.info(`Sensurering lagret for sak ${sakId}`);
      setLagreStatus({ type: "success", message: "Sensurering lagret!" });
      return true;
    } catch (error) {
      log.error(`Kunne ikke lagre sensurering for sak ${sakId}`, error);
      setLagreStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Kunne ikke lagre sensurering",
      });
      return false;
    } finally {
      setLagrer(false);
    }
  }, [sakId, originaltekst, sensurertListe]);

  useEffect(() => {
    if (autoSave && sensurertListe.length > 0 && !laster) {
      lagreSensurering();
    }
  }, [autoSave, sensurertListe, laster, lagreSensurering]);

  const handleLagreOgLukk = useCallback(async () => {
    const ok = await lagreSensurering();
    if (ok && onLagreOgLukk) {
      onLagreOgLukk();
    }
  }, [lagreSensurering, onLagreOgLukk]);

  return (
    <Box
      background="surface-default"
      padding="3"
      borderRadius="large"
      shadow="xsmall"
    >
      <VStack gap="2">
        {!autoSave && (
          <HStack gap="2" align="center">
            <FileTextIcon aria-hidden />
            <Heading size="xsmall">Marker sensitiv informasjon:</Heading>
          </HStack>
        )}

        {laster ? (
          <HStack gap="2" align="center">
            <Loader size="small" />
            <BodyShort>Laster eksisterende sensurering...</BodyShort>
          </HStack>
        ) : null}

        <div className="flex gap-4">
          <div className="flex-1">
            <div
              ref={editableRef}
              contentEditable={!readOnly}
              className={`min-h-[100px] p-3 border border-gray-300 rounded-lg
                         whitespace-pre-wrap font-mono text-sm
                         ${readOnly ? 'bg-gray-50 cursor-default' : 'bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'}`}
              suppressContentEditableWarning
            />
          </div>

          {sensurertListe.length > 0 && (
            <div className="w-64 shrink-0">
              <VStack gap="2">
                <HStack gap="2" align="center">
                  <Heading size="xsmall">Sensurerte verdier</Heading>
                  <Tag variant="warning" size="xsmall">
                    {sensurertListe.length}
                  </Tag>
                </HStack>
                {sensurertListe.map((item) => (
                  <Box
                    key={item.id}
                    background="surface-subtle"
                    padding="3"
                    borderRadius="medium"
                    borderColor="border-subtle"
                    borderWidth="1"
                  >
                    <VStack gap="1">
                      <HStack justify="space-between" align="center">
                        <Tag variant="neutral" size="xsmall" className="font-mono">
                          {item.placeholder}
                        </Tag>
                        {!readOnly && (
                          <Button
                            variant="tertiary-neutral"
                            size="xsmall"
                            icon={<XMarkIcon aria-hidden />}
                            onClick={() => fjernSensurering(item.id)}
                            title="Fjern sensurering"
                          />
                        )}
                      </HStack>
                      <code className="text-xs bg-red-50 text-red-800 px-2 py-1 rounded break-all">
                        {item.original}
                      </code>
                    </VStack>
                  </Box>
                ))}
              </VStack>
            </div>
          )}
        </div>

        {!autoSave && !readOnly && (
          <HStack gap="2">
            <Button
              variant="primary"
              size="small"
              icon={<FloppydiskIcon aria-hidden />}
              onClick={lagreSensurering}
              loading={lagrer}
            >
              Lagre
            </Button>
            <Button
              variant="secondary"
              size="small"
              onClick={handleLagreOgLukk}
              loading={lagrer}
            >
              Lagre og lukk
            </Button>
          </HStack>
        )}

        {lagreStatus && lagreStatus.type === "error" && (
          <Alert variant="error" size="small">
            {lagreStatus.message}
          </Alert>
        )}
      </VStack>
    </Box>
  );
};
