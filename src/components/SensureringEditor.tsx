import { useState, useRef, useCallback, useEffect } from "react";
import {
  Button,
  Box,
  VStack,
  HStack,
  Alert,
  Heading,
  BodyShort,
  Loader,
} from "@navikt/ds-react";
import {
  FloppydiskIcon,
  FileTextIcon,
} from "@navikt/aksel-icons";
import { sensureringApi } from "../api/sakApi";
import type { SensurertElement } from "../api/types";
import { createLogger } from "../logger";

const log = createLogger("Sensurering");

type SensurertItem = SensurertElement & { id: string };

interface SensureringEditorProps {
  sakId: string;
  onLagreOgLukk?: (sensurertTekst: string) => void;
  onAvbryt?: () => void;
  onAuthError?: () => void;
  autoSave?: boolean;
  readOnly?: boolean;
  singleSaveButton?: boolean;
  kommentarModus?: boolean;
}

export const SensureringEditor = ({ sakId, onLagreOgLukk, onAvbryt, onAuthError, autoSave = false, readOnly = false, singleSaveButton = false, kommentarModus = false }: SensureringEditorProps) => {
  const [sensurertListe, setSensurertListe] = useState<SensurertItem[]>([]);
  const [originaltekst, setOriginaltekst] = useState("");
  const [lagrer, setLagrer] = useState(false);
  const [laster, setLaster] = useState(true);
  const [lagreStatus, setLagreStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const editableRef = useRef<HTMLDivElement>(null);
  const removeButtonRef = useRef<HTMLButtonElement>(null);
  const hoveredSpanRef = useRef<HTMLElement | null>(null);
  const nextPlaceholderIndex = useRef(0);
  const existingDataRef = useRef<{ originaltekst: string; sensurertTekst: string; sensurertElementer: SensurertElement[] } | null>(null);

  const genererPlaceholder = () => {
    nextPlaceholderIndex.current += 1;
    return `[SLADDET-${nextPlaceholderIndex.current}]`;
  };

  const buildSensurertTekst = useCallback(() => {
    if (!editableRef.current) return "";
    let result = "";
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent || "";
      } else if (node instanceof HTMLElement && node.dataset.sensurertId) {
        result += node.dataset.placeholder || "";
      } else {
        for (const child of node.childNodes) {
          walk(child);
        }
      }
    };
    walk(editableRef.current);
    return result;
  }, []);

  useEffect(() => {
    if (!sakId) return;
    setLaster(true);
    sensureringApi
      .hent(sakId)
      .then((data) => {
        if (kommentarModus) {
          existingDataRef.current = {
            originaltekst: data.originaltekst,
            sensurertTekst: data.sensurertTekst,
            sensurertElementer: data.sensurertElementer,
          };
          nextPlaceholderIndex.current = data.sensurertElementer.length;
        } else {
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
                `<span class="sensurert-span" data-sensurert-id="${item.id}" data-placeholder="${item.placeholder}">${item.original}</span>`
              );
            });
            editableRef.current.innerHTML = html;
          }
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

    const range = selection.getRangeAt(0);

    if (!editableRef.current?.contains(range.commonAncestorContainer)) {
      return;
    }

    const overlappingSpans: HTMLElement[] = [];
    editableRef.current.querySelectorAll("[data-sensurert-id]").forEach((span) => {
      if (range.intersectsNode(span)) {
        overlappingSpans.push(span as HTMLElement);
      }
    });

    for (const s of overlappingSpans) {
      const spanRange = document.createRange();
      spanRange.selectNode(s);
      if (range.compareBoundaryPoints(Range.START_TO_START, spanRange) > 0) {
        range.setStartBefore(s);
      }
      if (range.compareBoundaryPoints(Range.END_TO_END, spanRange) < 0) {
        range.setEndAfter(s);
      }
    }

    const overlappingIds = new Set(
      overlappingSpans.map((s) => s.dataset.sensurertId).filter(Boolean)
    );

    let combinedOriginal = "";
    const walker = document.createTreeWalker(
      editableRef.current,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;
          if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
          if (node instanceof HTMLElement && node.dataset.sensurertId) return NodeFilter.FILTER_ACCEPT;
          return NodeFilter.FILTER_SKIP;
        },
      }
    );

    let current = walker.nextNode();
    while (current) {
      if (current.nodeType === Node.TEXT_NODE) {
        const parent = current.parentElement;
        if (parent?.dataset.sensurertId) {
          current = walker.nextNode();
          continue;
        }
        let text = current.textContent || "";
        if (current === range.startContainer && current === range.endContainer) {
          text = text.slice(range.startOffset, range.endOffset);
        } else if (current === range.startContainer) {
          text = text.slice(range.startOffset);
        } else if (current === range.endContainer) {
          text = text.slice(0, range.endOffset);
        }
        combinedOriginal += text;
      } else if (current instanceof HTMLElement && current.dataset.sensurertId) {
        const itemId = current.dataset.sensurertId;
        const item = sensurertListe.find((si) => si.id === itemId);
        if (item) {
          combinedOriginal += item.original;
        }
      }
      current = walker.nextNode();
    }

    if (!combinedOriginal.trim()) {
      selection.removeAllRanges();
      return;
    }

    if (sensurertListe.length === 0) {
      setOriginaltekst(editableRef.current?.innerText || "");
    }

    const nyId = crypto.randomUUID();
    const placeholder = genererPlaceholder();

    const span = document.createElement("span");
    span.className = "sensurert-span";
    span.dataset.sensurertId = nyId;
    span.dataset.placeholder = placeholder;
    span.textContent = combinedOriginal;

    range.deleteContents();
    range.insertNode(span);

    if (!span.nextSibling || (span.nextSibling.nodeType !== Node.TEXT_NODE)) {
      span.parentNode?.insertBefore(document.createTextNode("\u00A0"), span.nextSibling);
    }

    selection.removeAllRanges();

    setSensurertListe((prev) => {
      const filtered = prev.filter((s) => !overlappingIds.has(s.id));
      const updated = [
        ...filtered,
        { original: combinedOriginal, placeholder, id: nyId },
      ];
      const offset = kommentarModus ? (existingDataRef.current?.sensurertElementer.length ?? 0) : 0;
      const renumbered = updated.map((s, i) => {
        const newPlaceholder = `[SLADDET-${offset + i + 1}]`;
        if (s.placeholder !== newPlaceholder) {
          const el = editableRef.current?.querySelector(`[data-sensurert-id="${s.id}"]`);
          if (el) (el as HTMLElement).dataset.placeholder = newPlaceholder;
        }
        return { ...s, placeholder: newPlaceholder };
      });
      nextPlaceholderIndex.current = offset + renumbered.length;
      return renumbered;
    });
  }, [sensurertListe, kommentarModus]);

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

    const remaining = sensurertListe.filter((s) => s.id !== itemId);
    const offset = kommentarModus ? (existingDataRef.current?.sensurertElementer.length ?? 0) : 0;
    const renumbered = remaining.map((s, i) => {
      const newPlaceholder = `[SLADDET-${offset + i + 1}]`;
      if (s.placeholder !== newPlaceholder) {
        const el = editableRef.current?.querySelector(`[data-sensurert-id="${s.id}"]`);
        if (el) (el as HTMLElement).dataset.placeholder = newPlaceholder;
      }
      return { ...s, placeholder: newPlaceholder };
    });

    nextPlaceholderIndex.current = offset + renumbered.length;
    setSensurertListe(renumbered);
  }, [sensurertListe]);

  const lagreSensurering = useCallback(async () => {
    if (!sakId) return;
    setLagrer(true);
    setLagreStatus(null);
    try {
      const sensurertTekst = buildSensurertTekst();
      const existing = existingDataRef.current;
      const nyeElementer = sensurertListe.map(({ placeholder, original }) => ({
        placeholder,
        original,
      }));
      await sensureringApi.lagre(sakId, {
        originaltekst: kommentarModus && existing ? existing.originaltekst : originaltekst,
        sensurertTekst: kommentarModus && existing ? existing.sensurertTekst : sensurertTekst,
        sensurertElementer: kommentarModus && existing
          ? [...existing.sensurertElementer, ...nyeElementer]
          : nyeElementer,
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
      const sensurertTekst = buildSensurertTekst();
      onLagreOgLukk(sensurertTekst);
    }
  }, [lagreSensurering, onLagreOgLukk]);

  return (
    <Box
      background="danger-soft"
      padding="space-12"
      borderRadius="8"
    >
      <VStack gap="space-8">
        {!autoSave && (
          <HStack gap="space-8" align="center">
            <FileTextIcon aria-hidden />
            <Heading size="xsmall">Marker sensitiv informasjon:</Heading>
          </HStack>
        )}

        {laster ? (
          <HStack gap="space-8" align="center">
            <Loader size="small" />
            <BodyShort>Laster eksisterende sensurering...</BodyShort>
          </HStack>
        ) : null}

        <div className="relative">
          <div
            ref={editableRef}
            contentEditable={!readOnly}
            className={`min-h-[100px] p-3 border border-gray-300 rounded-lg
                       whitespace-pre-wrap font-mono text-sm
                       ${readOnly ? 'bg-gray-50 cursor-default' : 'bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'}`}
            suppressContentEditableWarning
            onMouseOver={(e) => {
              if (readOnly) return;
              const target = (e.target as HTMLElement).closest('[data-sensurert-id]') as HTMLElement | null;
              if (target && removeButtonRef.current) {
                hoveredSpanRef.current = target;
                const containerRect = editableRef.current!.getBoundingClientRect();
                const spanRect = target.getBoundingClientRect();
                const btn = removeButtonRef.current;
                btn.style.top = `${spanRect.top - containerRect.top - 8}px`;
                btn.style.left = `${spanRect.right - containerRect.left - 4}px`;
                btn.style.display = 'flex';
              }
            }}
            onMouseOut={(e) => {
              const related = e.relatedTarget as HTMLElement | null;
              if (
                related &&
                (related === removeButtonRef.current ||
                  removeButtonRef.current?.contains(related) ||
                  related.closest('[data-sensurert-id]'))
              ) return;
              if (removeButtonRef.current) removeButtonRef.current.style.display = 'none';
              hoveredSpanRef.current = null;
            }}
          />
          {!readOnly && (
            <button
              ref={removeButtonRef}
              type="button"
              style={{ display: 'none', position: 'absolute', zIndex: 10 }}
              className="items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-xs leading-none hover:bg-red-700"
              onMouseLeave={() => {
                if (removeButtonRef.current) removeButtonRef.current.style.display = 'none';
                hoveredSpanRef.current = null;
              }}
              onClick={() => {
                const span = hoveredSpanRef.current;
                if (span) {
                  const id = span.dataset.sensurertId;
                  if (id) fjernSensurering(id);
                }
                if (removeButtonRef.current) removeButtonRef.current.style.display = 'none';
                hoveredSpanRef.current = null;
              }}
            >
              ✕
            </button>
          )}
        </div>

        {!autoSave && !readOnly && (
          <HStack gap="space-8">
            {singleSaveButton ? (
              <>
                <Button
                  variant="primary"
                  size="small"
                  icon={<FloppydiskIcon aria-hidden />}
                  onClick={handleLagreOgLukk}
                  loading={lagrer}
                >
                  Lagre
                </Button>
                {onAvbryt && (
                  <Button
                    variant="tertiary"
                    size="small"
                    onClick={onAvbryt}
                  >
                    Avbryt
                  </Button>
                )}
              </>
            ) : (
              <>
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
              </>
            )}
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
