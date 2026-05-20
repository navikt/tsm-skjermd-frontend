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

export interface SensurertElement {
  placeholder: string;
  original: string;
}

export interface LagreSensureringRequest {
  originaltekst: string;
  sensurertTekst: string;
  sensurertElementer: SensurertElement[];
}

export interface LagreSensureringResponse {
  id: string;
  originaltekst: string;
  sensurertTekst: string;
  sensurertElementer: SensurertElement[];
  opprettetAv: string;
  opprettetTidspunkt: string;
}

export interface OpprettKommentarRequest {
  tekst: string;
}

export interface Kommentar {
  id: string;
  sensurertTekst: string;
  originalTekst: string;
  opprettetAv: string;
  opprettetTidspunkt: string;
}

export interface UserInfo {
  navIdent: string;
  name: string;
  email: string | null;
}

export interface BrukerSøkResult {
  displayName: string;
  navIdent: string;
  email: string | null;
}

export interface LeseloggRequest {
  begrunnelse: string;
}

export interface FilInfo {
  id: string;
  filnavn: string;
  contentType: string;
  storrelse: number;
  lastetOppAv: string;
  lastetOppTidspunkt: string;
}
