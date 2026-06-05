export interface SensurertElementInput {
  id: string;
  placeholder: string;
  original: string;
}

export interface SensurertPosisjon {
  start: number;
  end: number;
  item: SensurertElementInput;
}

export const matchSensurertePosisjoner = (
  sensurertTekst: string,
  elementer: SensurertElementInput[],
): SensurertPosisjon[] => {
  const tilgjengelig = elementer.map((item) => ({ item, brukt: false }));
  const posisjoner: SensurertPosisjon[] = [];
  const runRegex = /\*+/g;
  let match: RegExpExecArray | null;

  while ((match = runRegex.exec(sensurertTekst)) !== null) {
    const runLengde = match[0].length;
    const treff = tilgjengelig.find(
      (kandidat) => !kandidat.brukt && kandidat.item.placeholder.length === runLengde,
    );
    if (treff) {
      treff.brukt = true;
      posisjoner.push({ start: match.index, end: match.index + runLengde, item: treff.item });
    }
  }

  return posisjoner;
};
