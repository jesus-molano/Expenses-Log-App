import { describe, expect, it } from "vitest";
import { emptyStore } from "@/domain/seed";
import type { BankMovement, ExpenseStore, ExpenseTemplate } from "@/domain/types";
import {
  bankMatrixToRows,
  detectBankColumns,
  detectRecurringMovementGroups,
  matchBankMovements,
  normalizeBankMovements,
} from "./bank-import";

function template(overrides: Partial<ExpenseTemplate>): ExpenseTemplate {
  return {
    id: overrides.id ?? "icloud",
    userId: "user-1",
    name: overrides.name ?? "iCloud",
    description: "",
    amount: overrides.amount ?? 2.99,
    currency: "EUR",
    categoryId: "cat-general",
    startDate: overrides.startDate ?? "2026-05-13",
    dueDay: overrides.dueDay ?? 13,
    recurrence: overrides.recurrence ?? { frequency: "monthly" },
    active: overrides.active ?? true,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
  };
}

function store(overrides: Partial<ExpenseStore> = {}): ExpenseStore {
  return {
    ...emptyStore,
    ...overrides,
    finance: overrides.finance ?? emptyStore.finance,
    deleted: overrides.deleted ?? emptyStore.deleted,
    preferences: overrides.preferences ?? emptyStore.preferences,
    bankMovements: overrides.bankMovements ?? [],
    bankMerchantAliases: overrides.bankMerchantAliases ?? [],
  };
}

function movementsFrom(rows: Record<string, unknown>[]) {
  return normalizeBankMovements(rows, detectBankColumns(rows));
}

describe("bank import domain", () => {
  it("detects bank table headers after metadata rows", () => {
    const rows = bankMatrixToRows([
      ["Consulta de movimientos", "", "", "", ""],
      ["Cuenta: ", "ES67 0081 2717 3400 2267 0386", "", "", ""],
      ["Selección:", "Desde 01/01/2026 hasta 13/06/2026", "", "", ""],
      ["F. Operativa", "Concepto", "F. Valor", "Importe", "Saldo"],
      [
        "15/06/2026",
        "COMPRA TARJ. 5402XXXXXXXX1018 WWW.DAZN.COM-Madrid",
        "16/06/2026",
        "-14.99",
        "134.26",
      ],
    ]);

    expect(rows).toEqual([
      {
        "F. Operativa": "15/06/2026",
        Concepto: "COMPRA TARJ. 5402XXXXXXXX1018 WWW.DAZN.COM-Madrid",
        "F. Valor": "16/06/2026",
        Importe: "-14.99",
        Saldo: "134.26",
        Cuenta: "ES67 0081 2717 3400 2267 0386",
      },
    ]);
    expect(normalizeBankMovements(rows, detectBankColumns(rows))[0]).toMatchObject({
      bookedAt: "2026-06-15",
      amount: -14.99,
      account: "ES67 0081 2717 3400 2267 0386",
    });
  });

  it("prioritizes BBVA movement date and available balance columns", () => {
    const rows = bankMatrixToRows([
      ["", "", "Últimos movimientos", "", "", "", "", "", ""],
      ["", "", "Fecha de generación del informe: 13/06/2026", "", "", "", "", "", ""],
      [
        "F.Valor",
        "Fecha",
        "Concepto",
        "Movimiento",
        "Importe",
        "Divisa",
        "Disponible",
        "Divisa",
        "Observaciones",
      ],
      [
        "13/06/2026",
        "15/06/2026",
        "Mcdonalds taco santa cruz dees",
        "Pago con tarjeta",
        "-19.42",
        "EUR",
        "58.13",
        "EUR",
        "4188202161624661 MCDONALDS TACO",
      ],
    ]);
    const mapping = detectBankColumns(rows);
    const [movement] = normalizeBankMovements(rows, mapping);

    expect(mapping).toMatchObject({
      dateColumn: "Fecha",
      descriptionColumn: "Concepto",
      amountColumn: "Importe",
      balanceColumn: "Disponible",
    });
    expect(movement).toMatchObject({
      bookedAt: "2026-06-15",
      amount: -19.42,
      balance: 58.13,
    });
  });

  it("normalizes EU dates, decimal comma and debit columns", () => {
    const [movement] = movementsFrom([
      {
        Fecha: "13/06/2026",
        Descripcion: "APPLE.COM/BILL",
        Cargo: "2,99",
        Saldo: "1.234,56",
        Cuenta: "ES12",
      },
    ]);

    expect(movement).toMatchObject({
      bookedAt: "2026-06-13",
      description: "APPLE.COM/BILL",
      amount: -2.99,
      balance: 1234.56,
      account: "ES12",
      merchantKey: "apple",
    });
  });

  it("normalizes money values with euro symbols", () => {
    const [movement] = movementsFrom([
      {
        Fecha: "13/06/2026",
        Descripcion: "APPLE.COM/BILL",
        Cargo: "€2,99",
      },
    ]);

    expect(movement).toMatchObject({
      amount: -2.99,
    });
  });

  it("matches a bank merchant alias to an existing expense", () => {
    const movements = movementsFrom([
      {
        Fecha: "13/06/2026",
        Descripcion: "APPLE.COM/BILL",
        Cargo: "2,99",
      },
    ]);
    const analysis = matchBankMovements(
      store({
        templates: [template({ id: "icloud", name: "iCloud" })],
        bankMerchantAliases: [
          {
            id: "alias-apple",
            userId: "user-1",
            merchantKey: "apple",
            templateId: "icloud",
            label: "APPLE.COM/BILL",
            createdAt: "2026-06-01T00:00:00.000Z",
            updatedAt: "2026-06-01T00:00:00.000Z",
          },
        ],
      }),
      movements,
    );

    expect(analysis.candidates[0]).toMatchObject({
      kind: "match",
      matchedTemplateId: "icloud",
      matchedOccurrenceDate: "2026-06-13",
    });
  });

  it("groups recurring matches for the same existing expense across months", () => {
    const movements = movementsFrom([
      {
        Fecha: "13/05/2026",
        Descripcion: "COMPRA TARJ. WWW.DAZN.COM-Madrid",
        Cargo: "14,99",
      },
      {
        Fecha: "15/06/2026",
        Descripcion: "COMPRA TARJ. WWW.DAZN.COM-Madrid",
        Cargo: "14,99",
      },
    ]);
    const analysis = matchBankMovements(
      store({
        templates: [
          template({
            id: "dazn",
            name: "Dazn",
            amount: 14.99,
            startDate: "2026-05-13",
            dueDay: 13,
          }),
        ],
      }),
      movements,
    );

    expect(analysis.candidates).toHaveLength(1);
    expect(analysis.candidates[0]).toMatchObject({
      kind: "match",
      matchedTemplateId: "dazn",
      movements,
      matchedMovements: [
        {
          movementId: movements[0].id,
          occurrenceDate: "2026-05-13",
        },
        {
          movementId: movements[1].id,
          occurrenceDate: "2026-06-13",
        },
      ],
    });
  });

  it("detects recurring movements across different months", () => {
    const movements = movementsFrom([
      {
        Fecha: "01/05/2026",
        Descripcion: "OPENAI API",
        Cargo: "20,00",
      },
      {
        Fecha: "01/06/2026",
        Descripcion: "OPENAI API",
        Cargo: "20,00",
      },
    ]);

    expect(detectRecurringMovementGroups(movements)[0]?.recurrence).toEqual({
      frequency: "monthly",
    });
    expect(matchBankMovements(store(), movements).candidates[0]).toMatchObject({
      kind: "new_recurring",
      movements,
    });
  });

  it("infers the recurring due day from weekend-shifted bank charges", () => {
    const movements = movementsFrom([
      {
        Fecha: "13/05/2026",
        Descripcion: "DAZN",
        Cargo: "14,99",
      },
      {
        Fecha: "15/06/2026",
        Descripcion: "DAZN",
        Cargo: "14,99",
      },
    ]);
    const [candidate] = matchBankMovements(store(), movements).candidates;

    expect(candidate).toMatchObject({
      kind: "new_recurring",
      suggestedExpense: {
        startDate: "2026-06-13",
        dueDay: 13,
        recurrence: { frequency: "monthly" },
      },
    });
  });

  it("detects a recurring positive salary candidate", () => {
    const movements = movementsFrom([
      {
        Fecha: "28/05/2026",
        Descripcion: "NOMINA EMPRESA ACME",
        Abono: "2200,00",
      },
      {
        Fecha: "28/06/2026",
        Descripcion: "NOMINA EMPRESA ACME",
        Abono: "2200,00",
      },
    ]);
    const analysis = matchBankMovements(store(), movements);

    expect(analysis.candidates).toHaveLength(0);
    expect(analysis.incomeCandidates[0]).toMatchObject({
      kind: "income_salary",
      movements,
      suggestedSalary: {
        amount: 2200,
        dayOfMonth: 28,
      },
      salaryMatches: [
        {
          movementId: movements[0].id,
          monthId: "2026-05",
        },
        {
          movementId: movements[1].id,
          monthId: "2026-06",
        },
      ],
    });
  });

  it("keeps salary candidates together when amounts vary or first month is partial", () => {
    const movements = movementsFrom([
      {
        Fecha: "16/02/2026",
        Descripcion: "NOMINA EMPRESA ACME",
        Abono: "900,00",
      },
      {
        Fecha: "28/03/2026",
        Descripcion: "NOMINA EMPRESA ACME",
        Abono: "2200,00",
      },
      {
        Fecha: "28/04/2026",
        Descripcion: "NOMINA EMPRESA ACME",
        Abono: "2198,42",
      },
    ]);
    const analysis = matchBankMovements(store(), movements);

    expect(analysis.incomeCandidates).toHaveLength(1);
    expect(analysis.incomeCandidates[0]).toMatchObject({
      kind: "income_salary",
      movements,
      suggestedSalary: {
        amount: 2198.42,
      },
    });
  });

  it("infers salary payday from weekend-shifted income movements", () => {
    const movements = movementsFrom([
      {
        Fecha: "28/05/2026",
        Descripcion: "NOMINA EMPRESA ACME",
        Abono: "2200,00",
      },
      {
        Fecha: "29/06/2026",
        Descripcion: "NOMINA EMPRESA ACME",
        Abono: "2200,00",
      },
    ]);
    const analysis = matchBankMovements(store(), movements);

    expect(analysis.incomeCandidates[0]).toMatchObject({
      kind: "income_salary",
      suggestedSalary: {
        amount: 2200,
        dayOfMonth: 28,
      },
    });
  });

  it("classifies isolated positive movements as one-off income candidates", () => {
    const movements = movementsFrom([
      {
        Fecha: "02/06/2026",
        Descripcion: "BIZUM JESUS",
        Abono: "45,00",
      },
    ]);
    const analysis = matchBankMovements(store(), movements);

    expect(analysis.incomeCandidates[0]).toMatchObject({
      kind: "income_once",
      suggestedIncome: {
        amount: 45,
        receivedAt: "2026-06-02",
      },
    });
  });

  it("marks already imported positive fingerprints as likely duplicates", () => {
    const [existing] = movementsFrom([
      {
        Fecha: "02/06/2026",
        Descripcion: "BIZUM JESUS",
        Abono: "45,00",
      },
    ]);
    const analysis = matchBankMovements(
      store({
        bankMovements: [existing],
      }),
      [existing],
    );

    expect(analysis.incomeCandidates[0]).toMatchObject({
      kind: "income_duplicate",
      confidence: 100,
      duplicate: {
        source: "existing",
        movement: existing,
        reason: "Ya existe un movimiento igual importado",
      },
      reason: "Ya existe un movimiento igual importado",
    });
  });

  it("marks repeated positive fingerprints in the same import as likely duplicates", () => {
    const movements = movementsFrom([
      {
        Fecha: "02/06/2026",
        Descripcion: "BIZUM JESUS",
        Abono: "45,00",
      },
      {
        Fecha: "02/06/2026",
        Descripcion: "BIZUM JESUS",
        Abono: "45,00",
      },
    ]);
    const analysis = matchBankMovements(store(), movements);

    expect(analysis.incomeCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "income_once",
        }),
        expect.objectContaining({
          kind: "income_duplicate",
          confidence: 100,
          duplicate: expect.objectContaining({
            source: "import",
            movement: movements[0],
            reason: "Repetido dentro de este archivo",
          }),
          reason: "Repetido dentro de este archivo",
        }),
      ]),
    );
  });

  it("classifies isolated movements as one-off candidates", () => {
    const movements = movementsFrom([
      {
        Fecha: "02/06/2026",
        Descripcion: "TRANSFERENCIA PUNTUAL",
        Cargo: "45,00",
      },
    ]);

    expect(matchBankMovements(store(), movements).candidates[0]).toMatchObject({
      kind: "new_once",
    });
  });

  it("ignores already imported fingerprints as duplicates", () => {
    const [movement] = movementsFrom([
      {
        Fecha: "02/06/2026",
        Descripcion: "NETFLIX",
        Cargo: "17,99",
      },
    ]);
    const existingMovement: BankMovement = {
      ...movement,
      matchedTemplateId: "netflix",
      matchedOccurrenceDate: "2026-06-02",
    };

    expect(
      matchBankMovements(
        store({
          bankMovements: [existingMovement],
        }),
        [movement],
      ).candidates[0],
    ).toMatchObject({
      kind: "duplicate",
      confidence: 100,
      duplicate: {
        source: "existing",
        movement: existingMovement,
        reason: "Ya existe un movimiento igual importado",
      },
      reason: "Ya existe un movimiento igual importado",
    });
  });

  it("marks repeated fingerprints in the same import as duplicates with stable ids", () => {
    const movements = movementsFrom([
      {
        Fecha: "02/06/2026",
        Descripcion: "NETFLIX",
        Cargo: "17,99",
      },
      {
        Fecha: "02/06/2026",
        Descripcion: "NETFLIX",
        Cargo: "17,99",
      },
    ]);
    const analysis = matchBankMovements(store(), movements);

    expect(movements[0].fingerprint).toBe(movements[1].fingerprint);
    expect(movements[0].id).not.toBe(movements[1].id);
    expect(analysis.candidates).toHaveLength(2);
    expect(new Set(analysis.candidates.map((candidate) => candidate.id)).size).toBe(2);
    expect(analysis.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringContaining(movements[0].id),
          kind: "new_once",
        }),
        expect.objectContaining({
          id: expect.stringContaining(movements[1].id),
          kind: "duplicate",
          confidence: 100,
          duplicate: expect.objectContaining({
            source: "import",
            movement: movements[0],
            reason: "Repetido dentro de este archivo",
          }),
          reason: "Repetido dentro de este archivo",
        }),
      ]),
    );
  });
});
