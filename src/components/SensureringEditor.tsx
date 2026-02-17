import { useState, useRef, useCallback, useEffect } from "react";
import {
  Button,
  Box,
  VStack,
  HStack,
  Alert,
  CopyButton,
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
} from "@navikt/aksel-icons";
import { sensureringApi } from "../api/sakApi";

interface SensurertTekst {
  original: string;
  placeholder: string;
  id: string;
}

interface SensureringEditorProps {
  sakId: string;
  onLagreOgLukk?: () => void;
  autoSave?: boolean;
}

export const SensureringEditor = ({ sakId, onLagreOgLukk, autoSave = false }: SensureringEditorProps) => {
  const [content, setContent] = useState("");
  const [contentHistory, setContentHistory] = useState<string[]>([]);
  const [sensurertListe, setSensurertListe] = useState<SensurertTekst[]>([]);
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

    setContentHistory((prev) => [...prev, editableRef.current?.innerHTML || ""]);

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

  const angre = useCallback(() => {
    if (contentHistory.length > 0 && editableRef.current) {
      const forrige = contentHistory[contentHistory.length - 1];
      editableRef.current.innerHTML = forrige;
      setContent(forrige);
      setSensurertListe((prev) => prev.slice(0, -1));
      setContentHistory((prev) => prev.slice(0, -1));
    }
  }, [contentHistory]);

  const angreAlt = useCallback(() => {
    if (editableRef.current && originaltekst) {
      editableRef.current.innerText = originaltekst;
      setContent(originaltekst);
    } else if (editableRef.current) {
      editableRef.current.innerHTML = "";
      setContent("");
    }
    setContentHistory([]);
    setSensurertListe([]);
    setLagreStatus(null);
  }, [originaltekst]);

  const hentRenTekst = useCallback(() => {
    return editableRef.current?.innerText || "";
  }, []);

  const lagreSensurering = useCallback(async () => {
    if (!sakId) return;
    setLagrer(true);
    setLagreStatus(null);
    try {
      const sensurertTekst = hentRenTekst();
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
  }, [sakId, originaltekst, hentRenTekst, sensurertListe]);

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

        <Alert variant="info" size="small">
          Marker tekst du ønsker å sensurere, og klikk &quot;Marker som sensitiv&quot;.
          Sensitiv informasjon vil bli erstattet med en placeholder.
        </Alert>

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
            disabled={contentHistory.length === 0}
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

        <div
          ref={editableRef}
          contentEditable
          className="min-h-[200px] p-4 border border-gray-300 rounded-lg
                     whitespace-pre-wrap font-mono text-sm bg-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
          onInput={(e) => setContent(e.currentTarget.innerHTML)}
          suppressContentEditableWarning
        />

        {sensurertListe.length > 0 && (
          <Box
            background="surface-subtle"
            padding="4"
            borderRadius="medium"
          >
            <VStack gap="3">
              <HStack gap="2" align="center">
                <Heading size="small">Sensurerte verdier</Heading>
                <Tag variant="warning" size="small">
                  {sensurertListe.length} element{sensurertListe.length > 1 ? "er" : ""}
                </Tag>
              </HStack>

              <div className="space-y-2">
                {sensurertListe.map((item) => (
                  <HStack
                    key={item.id}
                    gap="2"
                    align="center"
                    className="bg-white p-2 rounded border"
                  >
                    <Tag variant="neutral" size="small" className="font-mono">
                      {item.placeholder}
                    </Tag>
                    <span className="text-sm text-gray-600">→</span>
                    <code className="text-sm bg-red-50 text-red-800 px-2 py-1 rounded flex-1">
                      {item.original}
                    </code>
                    <CopyButton
                      copyText={item.original}
                      size="small"
                      variant="neutral"
                    />
                  </HStack>
                ))}
              </div>
            </VStack>
          </Box>
        )}

        {!autoSave && (
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
