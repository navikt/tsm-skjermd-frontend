export interface Tilgang {
  navIdent: string;
  gittAv: string;
  gittTidspunkt: string;
}

export interface Sak {
  id: string;
  jiraIssueKey: string | null;
  sensitivData: string;
  opprettetAv: string;
  opprettetTidspunkt: string;
  endretAv: string | null;
  endretTidspunkt: string | null;
  tilganger: Tilgang[];
}

export interface OpprettSakRequest {
  jiraIssueKey?: string;
  sensitivData: string;
}

export interface EndreSakRequest {
  sensitivData: string;
}

export interface GiTilgangRequest {
  navIdent: string;
}

export interface UserInfo {
  navIdent: string;
  name: string;
  email: string | null;
}
