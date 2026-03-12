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
  EyeSlashIcon,
  ArrowUndoIcon,
  FloppydiskIcon,
  FileTextIcon,
  XMarkIcon,
} from "@navikt/aksel-icons";
import { sensureringApi } from "../api/sakApi";
import type { SensurertElement } from "../api/types";

type SensurertItem = SensurertElement & { id: string };

interface SensureringEditorProps {
  sakId: string;
  onLagreOgLukk?: () => void;
  autoSave?: boolean;
  readOnly?: boolean;
}

export const SensureringEditor = ({ sakId, onLagreOgLukk, autoSave = false, readOnly = false }: SensureringEditorProps) => {
  const [content, setContent] = useState("");
  const [historyLength, setHistoryLength] = useState(0);
  const contentHistoryRef = useRef<string[]>([]);
  const [sensurertListe, setSensurertListe] = useState<SensurertItem[]>([]);
  const [originaltekst, setOriginaltekst] = useState("");
  const [lagrer, setLagrer] = useState(false);
  const [laster, setLaster] = useState(true);
  const [lagreStatus, setLagreStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const editableRef = useRef<HTMLDivElement>(null);

  const genererPlaceholder = (index: number) => `[SLADDET-${index + 1}]`;

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

        if (editableRef.current) {
          let html = data.sensurertTekst;
          liste.forEach((item) => {
            html = html.replace(
              item.placeholder,
              `<span class="bg-gray-900 text-white px-1 rounded font-mono" data-sensurert-id="${item.id}">${item.placeholder}</span>`
            );
          });
          editableRef.current.innerHTML = html;
          setContent(html);
        }
      })
      .catch(() => {
        // Ingen eksisterende sensurering funnet
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

    contentHistoryRef.current = [...contentHistoryRef.current, editableRef.current?.innerHTML || ""];
    setHistoryLength(contentHistoryRef.current.length);

    if (sensurertListe.length === 0) {
      setOriginaltekst(editableRef.current?.innerText || "");
    }

    const nyId = crypto.randomUUID();
    const placeholder = genererPlaceholder(sensurertListe.length);

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

    setContent(editableRef.current?.innerHTML || "");
  }, [sensurertListe.length]);

  const fjernSensurering = useCallback((itemId: string) => {
    const item = sensurertListe.find((s) => s.id === itemId);
    if (!item || !editableRef.current) return;

    contentHistoryRef.current = [...contentHistoryRef.current, editableRef.current.innerHTML];
    setHistoryLength(contentHistoryRef.current.length + 1);

    const span = editableRef.current.querySelector(`[data-sensurert-id="${itemId}"]`);
    if (span) {
      const textNode = document.createTextNode(item.original);
      span.replaceWith(textNode);
    }

    setSensurertListe((prev) => prev.filter((s) => s.id !== itemId));
    setContent(editableRef.current.innerHTML);
  }, [sensurertListe]);

  const angre = useCallback(() => {
    const history = contentHistoryRef.current;
    if (history.length > 0 && editableRef.current) {
      const forrige = history[history.length - 1];
      editableRef.current.innerHTML = forrige;
      setContent(forrige);
      setSensurertListe((prev) => prev.slice(0, -1));
      contentHistoryRef.current = history.slice(0, -1);
      setHistoryLength(contentHistoryRef.current.length);
    }
  }, []);

  const angreAlt = useCallback(() => {
    if (editableRef.current && originaltekst) {
      editableRef.current.innerText = originaltekst;
      setContent(originaltekst);
    } else if (editableRef.current) {
      editableRef.current.innerHTML = "";
      setContent("");
    }
    contentHistoryRef.current = [];
    setHistoryLength(0);
    setSensurertListe([]);
    setLagreStatus(null);
  }, [originaltekst]);

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
      setLagreStatus({ type: "success", message: "Sensurering lagret!" });
      return true;
    } catch (error) {
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
      padding="5"
      borderRadius="large"
      shadow="xsmall"
    >
      <VStack gap="4">
        {!autoSave && (
          <HStack gap="2" align="center">
            <FileTextIcon aria-hidden />
            <Heading size="xsmall">Sensitiv informasjon</Heading>
          </HStack>
        )}

        {laster ? (
          <HStack gap="2" align="center">
            <Loader size="small" />
            <BodyShort>Laster eksisterende sensurering...</BodyShort>
          </HStack>
        ) : null}

        {!readOnly && (
          <Alert variant="info" size="small">
            Marker tekst du ønsker å sensurere, og klikk &quot;Marker som sensitiv&quot;.
            Sensitiv informasjon vil bli erstattet med en placeholder.
          </Alert>
        )}

        {!readOnly && (
          <HStack gap="2" wrap>
            <Button
              variant="primary"
              size="small"
              icon={<EyeSlashIcon aria-hidden />}
              onClick={markerSomSensitiv}
            >
              Marker som sensitiv
            </Button>
            <Button
              variant="secondary"
              size="small"
              icon={<ArrowUndoIcon aria-hidden />}
              onClick={angre}
              disabled={historyLength === 0}
            >
              Angre
            </Button>
            <Button
              variant="secondary"
              size="small"
              icon={<><ArrowUndoIcon aria-hidden /><ArrowUndoIcon aria-hidden /></>}
              onClick={angreAlt}
              disabled={!content}
            >
              Angre alt
            </Button>
          </HStack>
        )}

        <div className="flex gap-4">
          <div className="flex-1">
            <div
              ref={editableRef}
              contentEditable={!readOnly}
              className={`min-h-[200px] p-4 border border-gray-300 rounded-lg
                         whitespace-pre-wrap font-mono text-sm
                         ${readOnly ? 'bg-gray-50 cursor-default' : 'bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'}`}
              onInput={(e) => setContent(e.currentTarget.innerHTML)}
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

        {lagreStatus && (
          <Alert variant={lagreStatus.type} size="small">
            {lagreStatus.message}
          </Alert>
        )}
      </VStack>
    </Box>
  );
};
