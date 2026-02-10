import { useState, useRef, useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";
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
  Loader,
} from "@navikt/ds-react";
import {
  EyeSlashIcon,
  ArrowUndoIcon,
  TrashIcon,
  ClipboardIcon,
  FloppydiskIcon,
} from "@navikt/aksel-icons";
import { sensureringApi } from "../api/sakApi";

interface SensurertTekst {
  original: string;
  placeholder: string;
  id: string;
}

export const Sensurering = () => {
  const { sakId } = useParams<{ sakId: string }>();
  const [content, setContent] = useState("");
  const [previousContent, setPreviousContent] = useState("");
  const [sensurertListe, setSensurertListe] = useState<SensurertTekst[]>([]);
  const [originaltekst, setOriginaltekst] = useState("");
  const [lagrer, setLagrer] = useState(false);
  const [laster, setLaster] = useState(true);
  const [lagreStatus, setLagreStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const editableRef = useRef<HTMLDivElement>(null);

  const genererPlaceholder = (index: number) => `[SLADDET-${index + 1}]`;

  // Hent eksisterende sensurering ved innlasting
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

        // Bygg opp HTML med sensurerte spans
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
        // Ingen eksisterende sensurering funnet, start med blankt
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

    // Sjekk at selection er innenfor editable div
    if (!editableRef.current?.contains(range.commonAncestorContainer)) {
      return;
    }

    // Lagre forrige state for angre-funksjon
    setPreviousContent(editableRef.current?.innerHTML || "");

    // Lagre originaltekst ved første sensurering
    if (sensurertListe.length === 0) {
      setOriginaltekst(editableRef.current?.innerText || "");
    }

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
    setOriginaltekst("");
    setLagreStatus(null);
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

  const lagreSensurering = useCallback(async () => {
    if (!sakId) return;
    setLagrer(true);
    setLagreStatus(null);
    try {
      await sensureringApi.lagre(sakId, {
        originaltekst,
        sensurertTekst: hentRenTekst(),
        sensurertElementer: sensurertListe.map(({ placeholder, original }) => ({
          placeholder,
          original,
        })),
      });
      setLagreStatus({ type: "success", message: "Sensurering lagret!" });
    } catch (error) {
      setLagreStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Kunne ikke lagre sensurering",
      });
    } finally {
      setLagrer(false);
    }
  }, [sakId, originaltekst, hentRenTekst, sensurertListe]);

  return (
    <Box className="max-w-3xl mx-auto">
      <VStack gap="6">
        <Heading size="large">Sensurering av tekst</Heading>
        <BodyShort size="small">Sak: {sakId}</BodyShort>

        {laster ? (
          <HStack gap="2" align="center">
            <Loader size="small" />
            <BodyShort>Laster eksisterende sensurering...</BodyShort>
          </HStack>
        ) : null}

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
                      variant="neutral"
                    />
                  </HStack>
                ))}
              </div>

              <HStack gap="2" className="mt-2">
                <Button
                  variant="primary"
                  size="small"
                  icon={<FloppydiskIcon aria-hidden />}
                  onClick={lagreSensurering}
                  loading={lagrer}
                  disabled={sensurertListe.length === 0}
                >
                  Lagre til backend
                </Button>
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

              {lagreStatus && (
                <Alert variant={lagreStatus.type} size="small" className="mt-2">
                  {lagreStatus.message}
                </Alert>
              )}
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
