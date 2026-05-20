import { useState } from "react";
import {
  BodyShort,
  Button,
  Detail,
  HStack,
  VStack,
  Modal,
} from "@navikt/ds-react";
import {
  TrashIcon,
  DownloadIcon,
  FileIcon,
} from "@navikt/aksel-icons";
import { filApi } from "../api/sakApi";
import type { FilInfo } from "../api/types";

function formatStorrelse(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function erBilde(contentType: string): boolean {
  return contentType.startsWith("image/");
}

function erPdf(contentType: string): boolean {
  return contentType === "application/pdf";
}

interface FileListProps {
  filer: FilInfo[];
  sakId: string;
  onFileDeleted: (filId: string) => void;
  readOnly?: boolean;
  authHeaders?: () => Promise<HeadersInit>;
}

export const FileList = ({ filer, sakId, onFileDeleted, readOnly }: FileListProps) => {
  const [slettModal, setSlettModal] = useState<string | null>(null);
  const [previewFil, setPreviewFil] = useState<FilInfo | null>(null);

  if (filer.length === 0) {
    return null;
  }

  const handleSlett = async (filId: string) => {
    try {
      await filApi.slett(sakId, filId);
      onFileDeleted(filId);
    } catch {
      // error handled by caller
    }
    setSlettModal(null);
  };

  const filUrl = (filId: string) => filApi.hentUrl(sakId, filId);

  return (
    <>
      <VStack gap="space-4">
        {filer.map((fil) => (
          <div
            key={fil.id}
            className="flex items-center justify-between p-2 rounded border border-gray-200 bg-white"
          >
            <HStack gap="space-8" align="center" className="min-w-0 flex-1">
              <FileIcon aria-hidden fontSize="1.25rem" className="text-gray-500 flex-shrink-0" />
              <VStack className="min-w-0">
                <BodyShort
                  size="small"
                  weight="semibold"
                  className="truncate cursor-pointer hover:underline"
                  onClick={() => {
                    if (erBilde(fil.contentType) || erPdf(fil.contentType)) {
                      setPreviewFil(fil);
                    } else {
                      window.open(filUrl(fil.id), "_blank");
                    }
                  }}
                  title={fil.filnavn}
                >
                  {fil.filnavn}
                </BodyShort>
                <Detail className="text-gray-500">
                  {formatStorrelse(fil.storrelse)} — {fil.lastetOppAv}
                </Detail>
              </VStack>
            </HStack>
            <HStack gap="space-4" className="flex-shrink-0">
              <Button
                variant="tertiary-neutral"
                size="xsmall"
                icon={<DownloadIcon aria-hidden />}
                as="a"
                href={filUrl(fil.id)}
                target="_blank"
                rel="noopener noreferrer"
                title="Last ned"
              />
              {!readOnly && (
                <Button
                  variant="tertiary-neutral"
                  size="xsmall"
                  icon={<TrashIcon aria-hidden />}
                  onClick={() => setSlettModal(fil.id)}
                  title="Slett fil"
                />
              )}
            </HStack>
          </div>
        ))}
      </VStack>

      <Modal
        open={slettModal !== null}
        onClose={() => setSlettModal(null)}
        header={{ heading: "Slett fil", closeButton: true }}
      >
        <Modal.Body>
          <BodyShort>
            Er du sikker på at du vil slette filen? Denne handlingen kan ikke angres.
          </BodyShort>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="danger"
            onClick={() => slettModal && handleSlett(slettModal)}
          >
            Slett
          </Button>
          <Button variant="secondary" onClick={() => setSlettModal(null)}>
            Avbryt
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        open={previewFil !== null}
        onClose={() => setPreviewFil(null)}
        header={{ heading: previewFil?.filnavn ?? "", closeButton: true }}
        width="large"
      >
        <Modal.Body>
          {previewFil && erBilde(previewFil.contentType) && (
            <img
              src={filUrl(previewFil.id)}
              alt={previewFil.filnavn}
              className="max-w-full max-h-[70vh] object-contain mx-auto block"
            />
          )}
          {previewFil && erPdf(previewFil.contentType) && (
            <iframe
              src={filUrl(previewFil.id)}
              title={previewFil.filnavn}
              className="w-full border-0"
              style={{ height: "70vh" }}
            />
          )}
        </Modal.Body>
      </Modal>
    </>
  );
};
