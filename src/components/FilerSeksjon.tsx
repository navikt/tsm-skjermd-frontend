import { BodyShort, VStack } from "@navikt/ds-react";
import { FileUploadZone } from "./FileUploadZone";
import { FileList } from "./FileList";
import type { FilInfo } from "../api/types";

interface FilerSeksjonProps {
  sakId: string;
  filer: FilInfo[];
  setFiler: React.Dispatch<React.SetStateAction<FilInfo[]>>;
}

export const FilerSeksjon = ({ sakId, filer, setFiler }: FilerSeksjonProps) => (
  <>
    <BodyShort size="small" weight="semibold">Filer</BodyShort>
    <div className="p-4 rounded" style={{ backgroundColor: "var(--ax-bg-danger-soft)" }}>
      <VStack gap="space-8">
        <FileUploadZone
          sakId={sakId}
          onFileUploaded={(fil) => setFiler((prev) => [fil, ...prev])}
        />
        <FileList
          filer={filer}
          sakId={sakId}
          onFileDeleted={(filId) => setFiler((prev) => prev.filter((f) => f.id !== filId))}
        />
      </VStack>
    </div>
  </>
);
