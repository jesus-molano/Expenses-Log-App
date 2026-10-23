import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore, ExpenseTemplate } from "@/domain/types";
import {
  createCategoryInStore,
  deleteCategoryInStore,
  updateCategoryInStore,
} from "./category-commands";
import { addExpenseToStore } from "./expense-commands";

const NOW = "2026-10-23T10:00:00.000Z";

function template(id: string, categoryId: string): ExpenseTemplate {
  return {
    id,
    userId: "demo",
    name: id,
    description: "",
    amount: 10,
    currency: "EUR",
    categoryId,
    startDate: "2026-09-01",
    dueDay: 5,
    recurrence: { frequency: "monthly" },
    active: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

describe("category commands", () => {
  beforeEach(() => {
    let id = 0;
    vi.spyOn(crypto, "randomUUID").mockImplementation(
      () => `00000000-0000-4000-8000-${String((id += 1)).padStart(12, "0")}`,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a custom category once and reuses it by name", () => {
    const created = createCategoryInStore(emptyStore, { name: " Viajes ", tone: "rose" }, NOW);

    expect(created.store.categories).toEqual([
      {
        id: "cat-00000000-0000-4000-8000-000000000001",
        userId: "demo",
        name: "Viajes",
        icon: "Tag",
        tone: "rose",
        updatedAt: NOW,
      },
    ]);

    const again = createCategoryInStore(created.store, { name: "viajes", tone: "blue" }, NOW);
    expect(again.store).toBe(created.store);
    expect(again.categoryId).toBe(created.categoryId);
    expect(createCategoryInStore(emptyStore, { name: "  ", tone: "blue" }).categoryId).toBeNull();
  });

  it("gives a preset name its own icon", () => {
    const created = createCategoryInStore(emptyStore, { name: "ocio", tone: "blue" }, NOW);
    expect(created.store.categories[0]).toMatchObject({ name: "Ocio", icon: "Gamepad2", tone: "blue" });
  });

  it("assigns new expenses to a custom category by its name", () => {
    const created = createCategoryInStore(emptyStore, { name: "Viajes", tone: "rose" }, NOW);
    const store = addExpenseToStore(created.store, {
      name: "Ryanair",
      description: "",
      amount: 80,
      categoryName: "viajes",
      startDate: "2026-10-01",
      dueDay: 3,
      recurrence: { frequency: "once" },
    });

    expect(store.categories).toHaveLength(1);
    expect(store.templates[0].categoryId).toBe(created.categoryId);
  });

  it("renames and recolours, refusing a name already in use", () => {
    let store = createCategoryInStore(emptyStore, { name: "Viajes", tone: "rose" }, NOW).store;
    store = createCategoryInStore(store, { name: "Regalos", tone: "green" }, NOW).store;
    const [viajes] = store.categories;

    const renamed = updateCategoryInStore(store, viajes.id, { name: "Vacaciones", tone: "blue" }, "2026-10-24T00:00:00.000Z");
    expect(renamed.categories[0]).toMatchObject({
      name: "Vacaciones",
      tone: "blue",
      updatedAt: "2026-10-24T00:00:00.000Z",
    });
    expect(updateCategoryInStore(store, viajes.id, { name: "regalos" })).toBe(store);
    expect(updateCategoryInStore(store, viajes.id, { name: "" })).toBe(store);
    expect(updateCategoryInStore(store, viajes.id, { tone: "rose" })).toBe(store);
    expect(updateCategoryInStore(store, "missing", { tone: "blue" })).toBe(store);
  });

  it("moves series, edited charges and history to the replacement before deleting", () => {
    const base: ExpenseStore = {
      ...emptyStore,
      categories: [
        { id: "viajes", userId: "demo", name: "Viajes", icon: "Tag", tone: "rose" },
        { id: "casa", userId: "demo", name: "Casa", icon: "Home", tone: "green" },
      ],
      templates: [template("vuelo", "viajes"), template("alquiler", "casa")],
      overrides: [
        {
          id: "ovr:alquiler:2026-10-05",
          userId: "demo",
          templateId: "alquiler",
          occurrenceDate: "2026-10-05",
          status: "paid",
          categoryId: "viajes",
          updatedAt: "2026-10-05T00:00:00.000Z",
        },
      ],
      occurrenceRecords: [
        {
          id: "record:vuelo:2026-09-05",
          userId: "demo",
          templateId: "vuelo",
          occurrenceDate: "2026-09-05",
          monthId: "2026-09",
          dueDate: "2026-09-05",
          name: "vuelo",
          description: "",
          plannedAmount: 10,
          currency: "EUR",
          categoryId: "viajes",
          categoryName: "Viajes",
          status: "paid",
          sortOrder: 0,
          source: "native",
          createdAt: "2026-09-05T00:00:00.000Z",
          updatedAt: "2026-09-05T00:00:00.000Z",
        },
      ],
    };

    const store = deleteCategoryInStore(base, "viajes", "Casa", NOW);

    expect(store.categories.map((item) => item.id)).toEqual(["casa"]);
    expect(store.templates.find((item) => item.id === "vuelo")).toMatchObject({
      categoryId: "casa",
      updatedAt: NOW,
    });
    expect(store.templates.find((item) => item.id === "alquiler")?.updatedAt).toBe(
      "2026-09-01T00:00:00.000Z",
    );
    expect(store.overrides[0]).toMatchObject({ categoryId: "casa", status: "paid", updatedAt: NOW });
    expect(store.occurrenceRecords?.[0]).toMatchObject({
      categoryId: "casa",
      categoryName: "Casa",
      updatedAt: NOW,
    });
    expect(store.deleted?.categories).toEqual(["viajes"]);
  });

  it("creates a preset replacement that does not exist yet", () => {
    const base: ExpenseStore = {
      ...emptyStore,
      categories: [{ id: "viajes", userId: "demo", name: "Viajes", icon: "Tag", tone: "rose" }],
      templates: [template("vuelo", "viajes")],
    };

    const store = deleteCategoryInStore(base, "viajes", "General", NOW);
    const general = store.categories.find((item) => item.name === "General");

    expect(general).toMatchObject({ icon: "WalletCards", tone: "slate" });
    expect(store.templates[0].categoryId).toBe(general?.id);
    expect(deleteCategoryInStore(base, "missing", "General")).toBe(base);
  });
});
