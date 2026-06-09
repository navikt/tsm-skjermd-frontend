import { useState, useRef, useCallback } from "react";
import { LocalAlert, BodyShort, Loader } from "@navikt/ds-react";
import { UploadIcon } from "@navikt/aksel-icons";
import { filApi } from "../api/sakApi";
import type { FilInfo } from "../api/types";

const TILLATTE_TYPER = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/gif",
];

const TILLATTE_EXTENSIONS = ".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.gif";
const MAX_SIZE = 10 * 1024 * 1024;

function validerFil(file: File): string | null {
  if (!TILLATTE_TYPER.includes(file.type)) {
    return `Filtypen "${file.type || file.name.split(".").pop()}" er ikke tillatt. Tillatte typer: PDF, DOCX, XLSX, JPG, PNG, GIF.`;
  }
  if (file.size > MAX_SIZE) {
    return `Filen er for stor (${(file.size / 1024 / 1024).toFixed(1)} MB). Maks størrelse er 10 MB.`;
  }
  return null;
}

interface FileUploadZoneProps {
  sakId: string;
  onFileUploaded: (fil: FilInfo) => void;
}

export const FileUploadZone = ({ sakId, onFileUploaded }: FileUploadZoneProps) => {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (file: File) => {
    const valideringsfeil = validerFil(file);
    if (valideringsfeil) {
      setError(valideringsfeil);
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const metadata = await filApi.lastOpp(sakId, file);
      onFileUploaded(metadata);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke laste opp fil");
    } finally {
      setUploading(false);
    }
  }, [sakId, onFileUploaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleUpload(files[0]);
    }
  }, [handleUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleUpload(files[0]);
    }
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [handleUpload]);

  return (
    <div className="space-y-2">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
          dragOver
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={TILLATTE_EXTENSIONS}
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Last opp fil"
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader size="small" title="Laster opp..." />
            <BodyShort size="small" className="text-gray-500">Laster opp...</BodyShort>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <UploadIcon aria-hidden fontSize="1.5rem" className="text-gray-400" />
            <BodyShort size="small" className="text-gray-500">
              Dra og slipp fil her, eller klikk for å velge
            </BodyShort>
            <BodyShort size="small" className="text-gray-400">
              PDF, DOCX, XLSX, JPG, PNG, GIF — maks 10 MB, maks 20 filer per sak
            </BodyShort>
          </div>
        )}
      </div>
      {error && (
        <LocalAlert status="error" size="small">
          <LocalAlert.Header>
            <LocalAlert.Title as="div">{error}</LocalAlert.Title>
            <LocalAlert.CloseButton onClick={() => setError(null)} />
          </LocalAlert.Header>
        </LocalAlert>
      )}
    </div>
  );
};
