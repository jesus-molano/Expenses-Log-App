import { describe, expect, it } from "vitest";
import { parseExpenseTextLocally } from "./parser";

const today = "2026-10-23";

function parseOne(text: string) {
  const [result] = parseExpenseTextLocally(text, { today });
  return result;
}

describe("parseExpenseTextLocally", () => {
  it.each([
    ["Netflix 15,99 mensual el dia 12", { name: "Netflix", amount: 15.99, dueDay: 12, categoryName: "Suscripciones", recurrence: { frequency: "monthly" } }],
    ["el 5 Netflix 12,99", { name: "Netflix", amount: 12.99, dueDay: 5 }],
    ["Netflix 12,99 el 5", { amount: 12.99, dueDay: 5 }],
    ["Spotify 10.99€ día 3", { name: "Spotify", amount: 10.99, dueDay: 3 }],
    ["alquiler 850 el 1", { name: "Alquiler", amount: 850, dueDay: 1, categoryName: "Casa" }],
    ["Hipoteca 1.234,56 día 2", { amount: 1234.56, dueDay: 2, categoryName: "Casa" }],
    ["Luz unos 60 euros cada dos meses", { amount: 60, recurrence: { frequency: "custom", interval: 2, unit: "month" }, categoryName: "Casa" }],
    ["Gimnasio 35 al mes el día 1", { name: "Gimnasio", amount: 35, dueDay: 1, categoryName: "Deporte", recurrence: { frequency: "monthly" } }],
    ["seguro del coche 420 al año en marzo", { amount: 420, categoryName: "Vehiculo", recurrence: { frequency: "yearly", annualMonth: 3 } }],
    ["IBI 300 anual en noviembre", { name: "IBI", amount: 300, recurrence: { frequency: "yearly", annualMonth: 11 } }],
    ["Agua trimestral 45", { amount: 45, recurrence: { frequency: "quarterly" } }],
    ["Comunidad 60 trimestral el 10", { amount: 60, dueDay: 10, recurrence: { frequency: "quarterly" } }],
    ["Parking 20 cada 2 semanas el 3", { amount: 20, recurrence: { frequency: "custom", interval: 2, unit: "week" } }],
    ["Clases de inglés 25 semanal", { amount: 25, recurrence: { frequency: "custom", interval: 1, unit: "week" } }],
    ["Canguro quincenal 40", { amount: 40, recurrence: { frequency: "custom", interval: 2, unit: "week" } }],
    ["Seguro médico 90 semestral", { amount: 90, categoryName: "Salud", recurrence: { frequency: "custom", interval: 6, unit: "month" } }],
    ["Revisión ITV 45 puntual el 12", { amount: 45, recurrence: { frequency: "once" }, startDate: "2026-10-12", dueDay: 12 }],
    ["Cena 85 una vez", { amount: 85, recurrence: { frequency: "once" }, startDate: today }],
    ["Internet fibra 30 el 15", { amount: 30, dueDay: 15, categoryName: "Servicios" }],
    ["iCloud 2,99", { name: "ICloud", amount: 2.99, categoryName: "Suscripciones" }],
    ["Pienso del perro 40 cada mes", { amount: 40, categoryName: "Mascotas", recurrence: { frequency: "monthly" } }],
    ["Bono transporte 20 mensual", { amount: 20, categoryName: "Transporte" }],
    ["Gasolina 60", { amount: 60, categoryName: "Vehiculo" }],
    ["Préstamo coche 210 el 28", { amount: 210, dueDay: 28 }],
    ["Disney+ 8,99 el 20", { name: "Disney+", amount: 8.99, dueDay: 20, categoryName: "Suscripciones" }],
    ["Apple TV+ 9,99", { name: "Apple TV+", amount: 9.99 }],
    ["HBO-Max 9,99", { name: "HBO-Max", amount: 9.99 }],
    ["Agua/luz 60", { name: "Agua/luz", amount: 60 }],
    ["Luz y gas 80", { name: "Luz y gas", amount: 80 }],
    ["Seguro 300 en marzo de 2027 al año", { amount: 300, recurrence: { frequency: "yearly", annualMonth: 3 } }],
    ["Seguro 300 al año 2026", { amount: 300 }],
    ["Gimnasio 35 a las 9", { name: "Gimnasio", amount: 35 }],
    ["Gimnasio 35 a las 9:30", { amount: 35 }],
    ["Seguro 300 el 15/03 anual", { amount: 300, dueDay: 15, recurrence: { frequency: "yearly", annualMonth: 3 } }],
    ["Dentista 80 el 12 de diciembre puntual", { amount: 80, recurrence: { frequency: "once" }, startDate: "2026-12-12", dueDay: 12 }],
    ["Matrícula 300 puntual en septiembre", { amount: 300, recurrence: { frequency: "once" }, startDate: "2027-09-01" }],
    ["Rent 900 on the 1st", { name: "Rent", amount: 900, dueDay: 1, categoryName: "Casa" }],
    ["Spotify 10.99 monthly on the 3rd", { amount: 10.99, dueDay: 3, recurrence: { frequency: "monthly" } }],
    ["Car insurance 420 yearly in March", { name: "Car insurance", amount: 420, recurrence: { frequency: "yearly", annualMonth: 3 } }],
    ["Insurance 400 a year in May", { name: "Insurance", amount: 400 }],
    ["Gym 35 every week", { amount: 35, recurrence: { frequency: "custom", interval: 1, unit: "week" } }],
    ["Plátanos 3", { name: "Plátanos", amount: 3, recurrence: { frequency: "monthly" } }],
    ["Colegio 2.200 anual en septiembre", { amount: 2200, recurrence: { frequency: "yearly", annualMonth: 9 } }],
    ["Agua 45 cada 3 meses día 10", { amount: 45, dueDay: 10, recurrence: { frequency: "quarterly" } }],
  ])("reads %j", (text, expected) => {
    const { draft } = parseOne(text);
    expect(draft).toMatchObject(expected);
  });

  it("marks a missing amount instead of inventing one", () => {
    const result = parseOne("Netflix el 5");

    expect(result.draft.amount).toBe(0);
    expect(result.missingFields).toContain("amount");
  });

  it("flags inferred day and frequency", () => {
    const result = parseOne("Spotify 10,99");

    expect(result.draft.dueDay).toBe(23);
    expect(result.inferredFields).toEqual(expect.arrayContaining(["dueDay", "frequency"]));
  });

  it("splits several expenses when each part has an amount", () => {
    const results = parseExpenseTextLocally(
      "Seguro del coche 420 al año en marzo y gimnasio 35 al mes el día 1",
      { today },
    );

    expect(results.map(({ draft }) => [draft.name, draft.amount])).toEqual([
      ["Seguro del coche", 420],
      ["Gimnasio", 35],
    ]);
    expect(parseExpenseTextLocally("luz y agua 60", { today })).toHaveLength(1);
  });

  it.each([
    ["Luz y gas 80 y Netflix 12,99", [["Luz y gas", 80], ["Netflix", 12.99]]],
    ["Rent and utilities 1000 and Netflix 12", [["Rent and utilities", 1000], ["Netflix", 12]]],
    ["Seguro de vida y hogar 300 al año y Netflix 12,99", [["Seguro de vida y hogar", 300], ["Netflix", 12.99]]],
    ["Gimnasio 35 el 1\nSpotify 10,99", [["Gimnasio", 35], ["Spotify", 10.99]]],
    ["Netflix 12,99 y Spotify", [["Netflix", 12.99], ["Spotify", 0]]],
  ])("keeps names with connectors when splitting %j", (text, expected) => {
    const results = parseExpenseTextLocally(text, { today });

    expect(results.map(({ draft }) => [draft.name, draft.amount])).toEqual(expected);
  });

  it("flags an amount picked among several numbers", () => {
    expect(parseOne("Netflix 2 pantallas 15").inferredFields).toContain("amount");
    expect(parseOne("Netflix 15,99").inferredFields).not.toContain("amount");
  });

  it("flags the date of a one-off expense with only a month", () => {
    expect(parseOne("Matrícula 300 puntual en septiembre").inferredFields).toContain("startDate");
    expect(parseOne("Dentista 80 el 12 de diciembre puntual").inferredFields).not.toContain("startDate");
  });

  it("uses the user's own category names", () => {
    const result = parseExpenseTextLocally("Netflix 12,99", {
      today,
      categories: ["Streaming"],
    })[0];

    expect(result.draft.categoryName).toBe("Suscripciones");
  });
});
