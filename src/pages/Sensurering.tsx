import { useState, useRef, useCallback } from "react";
import {
  Button,
  Heading,
  Box,
  VStack,
  HStack,
  Alert,
  CopyButton,
  Tag,
  BodyShort,
} from "@navikt/ds-react";
import {
  EyeSlashIcon,
  ArrowUndoIcon,
  TrashIcon,
  ClipboardIcon,
} from "@navikt/aksel-icons";

interface SensurertTekst {
  original: string;
  placeholder: string;
  id: string;
}

export const Sensurering = () => {
  const [content, setContent] = useState("");
  const [previousContent, setPreviousContent] = useState("");
  const [sensurertListe, setSensurertListe] = useState<SensurertTekst[]>([]);
  const editableRef = useRef<HTMLDivElement>(null);

  const genererPlaceholder = (index: number) => `[SLADDET-${index + 1}]`;

  const markerSomSensitiv = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.toString().trim() === "") {
      return;
    }

    const selectedText = selection.toString();
    const range = selection.getRangeAt(0);

    // Sjekk at selection er innenfor editable div
    if (!editableRef.current?.contains(range.commonAncestorContainer)) {
      return;
    }

    // Lagre forrige state for angre-funksjon
    setPreviousContent(editableRef.current?.innerHTML || "");

    const nyId = crypto.randomUUID();
    const placeholder = genererPlaceholder(sensurertListe.length);

    // Opprett span med markering
    const span = document.createElement("span");
    span.className = "bg-gray-900 text-white px-1 rounded font-mono";
    span.dataset.sensurertId = nyId;
    span.textContent = placeholder;

    // Erstatt markert tekst med span
    range.deleteContents();
    range.insertNode(span);
    selection.removeAllRanges();

    // Lagre sensurert tekst i liste
    setSensurertListe((prev) => [
      ...prev,
      { original: selectedText, placeholder, id: nyId },
    ]);

    // Oppdater content state
    setContent(editableRef.current?.innerHTML || "");
  }, [sensurertListe.length]);

  const angre = useCallback(() => {
    if (previousContent && editableRef.current) {
      editableRef.current.innerHTML = previousContent;
      setContent(previousContent);
      // Fjern siste element fra sensurert liste
      setSensurertListe((prev) => prev.slice(0, -1));
      setPreviousContent("");
    }
  }, [previousContent]);

  const nullstill = useCallback(() => {
    if (editableRef.current) {
      editableRef.current.innerHTML = "";
    }
    setContent("");
    setPreviousContent("");
    setSensurertListe([]);
  }, []);

  const hentRenTekst = useCallback(() => {
    // Returnerer teksten med placeholders (uten HTML)
    return editableRef.current?.innerText || "";
  }, []);

  const hentSensurertData = useCallback(() => {
    // Returnerer objekt med både ren tekst og liste over sensurerte verdier
    return {
      tekst: hentRenTekst(),
      sensurert: sensurertListe.map(({ original, placeholder }) => ({
        placeholder,
        original,
      })),
    };
  }, [hentRenTekst, sensurertListe]);

  return (
    <Box className="max-w-3xl mx-auto">
      <VStack gap="6">
        <Heading size="large">Sensurering av tekst</Heading>

        <Alert variant="info" size="small">
          Marker tekst du ønsker å sensurere, og klikk "Marker som sensitiv".
          Sensitiv informasjon vil bli erstattet med en placeholder.
        </Alert>

        <Box
          background="surface-default"
          padding="4"
          borderRadius="medium"
          shadow="small"
        >
          <VStack gap="4">
            <BodyShort weight="semibold">Lim inn eller skriv tekst:</BodyShort>

            <div
              ref={editableRef}
              contentEditable
              className="min-h-[200px] p-4 border border-gray-300 rounded-lg
                         whitespace-pre-wrap font-mono text-sm bg-white
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
              onInput={(e) => setContent(e.currentTarget.innerHTML)}
              suppressContentEditableWarning
            />

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
                disabled={!previousContent}
              >
                Angre
              </Button>
              <Button
                variant="tertiary"
                size="small"
                icon={<TrashIcon aria-hidden />}
                onClick={nullstill}
                disabled={!content}
              >
                Nullstill
              </Button>
            </HStack>
          </VStack>
        </Box>

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
                      variant="tertiary"
                    />
                  </HStack>
                ))}
              </div>

              <HStack gap="2" className="mt-2">
                <Button
                  variant="secondary"
                  size="small"
                  icon={<ClipboardIcon aria-hidden />}
                  onClick={() => {
                    const data = hentSensurertData();
                    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
                  }}
                >
                  Kopier all data (JSON)
                </Button>
              </HStack>
            </VStack>
          </Box>
        )}

        {/* Debug/Preview - kan fjernes i prod */}
        {content && (
          <Box background="surface-subtle" padding="4" borderRadius="medium">
            <VStack gap="2">
              <Heading size="xsmall">Ren tekst (for sending):</Heading>
              <pre className="text-xs bg-white p-3 rounded border overflow-auto">
                {hentRenTekst()}
              </pre>
            </VStack>
          </Box>
        )}
      </VStack>
    </Box>
  );
};
