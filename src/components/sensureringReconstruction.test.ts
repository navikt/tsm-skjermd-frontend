import { describe, it, expect } from "vitest";
import { matchSensurertePosisjoner } from "./sensureringReconstruction";

const element = (id: string, original: string) => ({
  id,
  original,
  placeholder: "*".repeat(original.length),
});

describe("matchSensurertePosisjoner", () => {
  it("matcher placeholders i tekstrekkefølge", () => {
    const elementer = [element("a", "Ola"), element("b", "Nordmann")];
    const tekst = "Hei *** her er ********";

    const pos = matchSensurertePosisjoner(tekst, elementer);

    expect(pos.map((p) => p.item.id)).toEqual(["a", "b"]);
    expect(pos[0]).toMatchObject({ start: 4, end: 7 });
    expect(pos[1]).toMatchObject({ start: 15, end: 23 });
  });

  it("tildeler kort placeholder til kort blokk selv når elementer er i opprettelsesrekkefølge", () => {
    const elementer = [element("siste", "X"), element("ord", "navn")];
    const tekst = "**** og *";

    const pos = matchSensurertePosisjoner(tekst, elementer);

    expect(pos.map((p) => p.item.id)).toEqual(["ord", "siste"]);
    expect(pos[0]).toMatchObject({ start: 0, end: 4, item: { id: "ord" } });
    expect(pos[1]).toMatchObject({ start: 8, end: 9, item: { id: "siste" } });
  });

  it("matcher ikke en kort placeholder inni en lengre stjerneblokk", () => {
    const elementer = [element("kort", "A"), element("lang", "Bcdef")];
    const tekst = "***** A";

    const pos = matchSensurertePosisjoner(tekst, elementer);

    expect(pos).toHaveLength(1);
    expect(pos[0]).toMatchObject({ start: 0, end: 5, item: { id: "lang" } });
  });

  it("skiller to like lange blokker som to ulike elementer", () => {
    const elementer = [element("en", "AA"), element("to", "BB")];
    const tekst = "** ** ";

    const pos = matchSensurertePosisjoner(tekst, elementer);

    expect(pos).toHaveLength(2);
    expect(pos[0]).toMatchObject({ start: 0, end: 2, item: { id: "en" } });
    expect(pos[1]).toMatchObject({ start: 3, end: 5, item: { id: "to" } });
  });

  it("returnerer tom liste når det ikke finnes stjerner", () => {
    expect(matchSensurertePosisjoner("ingen sensur her", [element("a", "X")])).toEqual([]);
  });
});
