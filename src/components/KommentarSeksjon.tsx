import { useState } from "react";
import {
  VStack,
  HStack,
  Table,
  Tag,
  Detail,
  BodyShort,
  Accordion,
} from "@navikt/ds-react";
import { SensureringEditor } from "./SensureringEditor";
import { kommentarApi } from "../api/sakApi";
import type { Kommentar, Sak } from "../api/types";
import { formatDato, formatTid, tekstTilJira } from "../utils/format";

interface KommentarSeksjonProps {
  sakId: string;
  sak: Sak | null;
  kommentarer: Kommentar[];
  setKommentarer: React.Dispatch<React.SetStateAction<Kommentar[]>>;
  kommentarerLoading: boolean;
  onError: (message: string) => void;
}

const createCommentInJira = (issueKey: string, text: string) => {
  const requestId = crypto.randomUUID();
  window.parent.postMessage({
    type: 'CREATE_JIRA_COMMENT',
    requestId,
    issueKey,
    text
  }, '*');
  return requestId;
};

export const KommentarSeksjon = ({
  sakId,
  sak,
  kommentarer,
  setKommentarer,
  kommentarerLoading,
  onError,
}: KommentarSeksjonProps) => {
  const [editing, setEditing] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  return (
    <>
      <BodyShort size="small" weight="semibold">Kommentar</BodyShort>
      <div
        className="p-4 rounded"
        style={{ backgroundColor: "var(--ax-bg-danger-soft)" }}
      >
        <div
          className={`transition-all ${editing ? '' : 'cursor-pointer hover:brightness-95'}`}
          onClick={() => { if (!editing) setEditing(true); }}
        >
          <SensureringEditor
            key={editorKey}
            sakId={sakId}
            kommentarModus
            singleSaveButton
            lagreKnappTekst="Lagre"
            showButtons={editing}
            onAvbryt={() => {
              setEditing(false);
              setEditorKey((k) => k + 1);
            }}
            onLagreOgLukk={async (sensurertTekst, originaltekst) => {
              if (!originaltekst.trim()) {
                setEditing(false);
                setEditorKey((k) => k + 1);
                return;
              }
              if (sak?.jiraIssueKey) {
                try {
                  const nyKommentar = await kommentarApi.opprett(sakId, { tekst: originaltekst });
                  setKommentarer((prev) => [nyKommentar, ...prev]);
                  createCommentInJira(sak.jiraIssueKey, tekstTilJira(sensurertTekst));
                } catch (err) {
                  onError(err instanceof Error ? err.message : "Kunne ikke opprette kommentar");
                  return;
                }
              }
              setEditing(false);
              setEditorKey((k) => k + 1);
            }}
          />
        </div>
        {sak && (
          <Accordion className="mt-4 accordion-borderless">
            <Accordion.Item>
              <Accordion.Header>
                <HStack gap="space-8" align="center">
                  <BodyShort size="small" weight="semibold">Kommentarer</BodyShort>
                  <Tag variant="neutral" size="xsmall">{kommentarer.length}</Tag>
                </HStack>
              </Accordion.Header>
              <Accordion.Content>
                <VStack gap="space-8">
                  {kommentarerLoading ? (
                    <Detail className="text-gray-500">Laster kommentarer...</Detail>
                  ) : kommentarer.length === 0 ? (
                    <Detail className="text-gray-500">Ingen kommentarer registrert ennå.</Detail>
                  ) : (
                    <Table size="small">
                      <Table.Header>
                        <Table.Row>
                          <Table.HeaderCell>Kommentar</Table.HeaderCell>
                          <Table.HeaderCell>Skrevet av</Table.HeaderCell>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {kommentarer.map((kommentar) => (
                          <Table.Row key={kommentar.id}>
                            <Table.DataCell>
                              <BodyShort size="small" className="whitespace-pre-wrap">
                                {kommentar.originalTekst}
                              </BodyShort>
                            </Table.DataCell>
                            <Table.DataCell>
                              <BodyShort size="small">
                                {formatDato(kommentar.opprettetTidspunkt)} kl. {formatTid(kommentar.opprettetTidspunkt)} — {kommentar.opprettetAv}
                              </BodyShort>
                            </Table.DataCell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table>
                  )}
                </VStack>
              </Accordion.Content>
            </Accordion.Item>
          </Accordion>
        )}
      </div>
    </>
  );
};
