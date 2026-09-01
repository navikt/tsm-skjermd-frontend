export type TilgangKilde = "DIREKTE" | "GRUPPE";

export interface Tilgang {
  navIdent: string;
  gittAv: string;
  gittTidspunkt: string;
  kilde?: TilgangKilde;
  gruppeId?: string | null;
  gruppeNavn?: string | null;
}

export interface GruppeTilgang {
  gruppeId: string;
  gruppeNavn: string;
  gruppeType?: GruppeType;
  gittAv: string;
  gittTidspunkt: string;
  medlemmer: string[];
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
  gruppeTilganger?: GruppeTilgang[];
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

export type GruppeType = "TEAM" | "OMRAADE" | "PRODUKTOMRAADE";

export interface Gruppe {
  id: string;
  navn: string;
  type: GruppeType;
  beskrivelse: string | null;
  antallMedlemmer: number;
}

export interface GruppeMedlem {
  navIdent: string;
  displayName: string;
  email: string | null;
}

export interface GiGruppeTilgangRequest {
  gruppeId: string;
}

export interface GiGruppeTilgangResponse {
  gruppeTilgang: GruppeTilgang;
  tilganger: Tilgang[];
}

export type AuditHandling =
  | "TILGANG_GITT"
  | "TILGANG_FJERNET"
  | "GRUPPETILGANG_GITT"
  | "GRUPPETILGANG_FJERNET";

export interface AuditHendelse {
  id: string;
  tidspunkt: string;
  utfoertAv: string;
  handling: AuditHandling;
  navIdent: string | null;
  gruppeId: string | null;
  gruppeNavn: string | null;
  antallBerorte: number | null;
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
