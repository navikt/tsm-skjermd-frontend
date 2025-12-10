export interface Sak {
  id: string;
  jiraIssueKey: string;
  sensitivData: string;
  opprettetAv: string;
  opprettetTidspunkt: string;
  endretAv: string | null;
  endretTidspunkt: string | null;
}

export interface OpprettSakRequest {
  jiraIssueKey: string;
  sensitivData: string;
}

export interface EndreSakRequest {
  sensitivData: string;
}
