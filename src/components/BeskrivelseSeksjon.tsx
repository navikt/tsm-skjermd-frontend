import { useState } from "react";
import { BodyShort } from "@navikt/ds-react";
import { SensureringEditor } from "./SensureringEditor";
import type { Sak } from "../api/types";
import { tekstTilJira } from "../utils/format";

interface BeskrivelseSeksjonProps {
  sakId: string;
  sak: Sak | null;
  getAccessToken: () => Promise<string>;
  onError: (message: string | null) => void;
}

export const BeskrivelseSeksjon = ({ sakId, sak, getAccessToken, onError }: BeskrivelseSeksjonProps) => {
  const [editing, setEditing] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  const sendBeskrivelseTilJira = async (jiraTekst: string) => {
    if (!sak?.jiraIssueKey) return;
    try {
      onError(null);
      const accessToken = await getAccessToken();
      await fetch("/embed/api/jira/update-description", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          issueKey: sak.jiraIssueKey,
          text: jiraTekst,
        }),
      });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Kunne ikke oppdatere Jira-beskrivelse");
    }
  };

  const handleLagreBeskrivelse = (sensurertTekst: string) => {
    setEditing(false);
    if (!sak?.jiraIssueKey) return;
    sendBeskrivelseTilJira(tekstTilJira(sensurertTekst));
  };

  return (
    <>
      <BodyShort size="small" weight="semibold">Beskrivelse</BodyShort>
      <div
        className={`p-4 rounded transition-all ${editing ? '' : 'cursor-pointer hover:brightness-95'}`}
        style={{ backgroundColor: "var(--ax-bg-danger-soft)" }}
        onClick={() => { if (!editing) setEditing(true); }}
      >
        <SensureringEditor
          key={editorKey}
          sakId={sakId}
          singleSaveButton
          lagreKnappTekst="Lagre"
          showButtons={editing}
          onLagreOgLukk={handleLagreBeskrivelse}
          onAvbryt={() => {
            setEditing(false);
            setEditorKey((k) => k + 1);
          }}
        />
      </div>
    </>
  );
};
