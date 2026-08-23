import type { ExpenseCategory, ExpenseStore, ExpenseTemplate } from "./types";
import { defaultFinanceStore, emptyFinanceStore } from "./finance";

export const emptyStore: ExpenseStore = {
  categories: [],
  templates: [],
  overrides: [],
  finance: emptyFinanceStore,
  bankMovements: [],
  bankMerchantAliases: [],
  deleted: {
    categories: [],
    templates: [],
    overrides: [],
    incomeEvents: [],
    bankMovements: [],
    bankMerchantAliases: [],
  },
  preferences: {
    theme: "vice-afterglow",
    language: "es",
  },
};

const categories: ExpenseCategory[] = [
  category("cat-home", "Casa", "Home", "green"),
  category("cat-food", "Alimentacion", "Utensils", "orange"),
  category("cat-services", "Servicios", "WalletCards", "blue"),
  category("cat-subscriptions", "Suscripciones", "Sparkles", "violet"),
  category("cat-vehicle", "Vehiculo", "Car", "orange"),
  category("cat-transport", "Transporte", "TrainFront", "blue"),
  category("cat-health", "Salud", "HeartPulse", "rose"),
  category("cat-sport", "Deporte", "Dumbbell", "green"),
  category("cat-debt", "Deudas", "CreditCard", "rose"),
  category("cat-savings", "Ahorro", "PiggyBank", "green"),
  category("cat-leisure", "Ocio", "Gamepad2", "violet"),
  category("cat-work", "Educacion/Trabajo", "BriefcaseBusiness", "blue"),
  category("cat-pets", "Mascotas", "PawPrint", "green"),
  category("cat-personal", "Personal", "User", "green"),
  category("cat-general", "General", "WalletCards", "slate"),
];

export const demoStore: ExpenseStore = {
  categories,
  templates: [
    template("exp-home-expenses", "Gastos de casa", "Piso y suministros", 660, "cat-home", "2026-01-01", 1),
    template("exp-food", "Compra mensual", "Supermercado estimado", 260, "cat-food", "2026-01-01", 2),
    template("exp-movistar", "Movistar", "Linea y fibra", 60, "cat-services", "2026-01-08", 8),
    template("exp-game-pass", "Game Pass", "Suscripcion gaming", 12, "cat-subscriptions", "2026-01-12", 12),
    template("exp-deudas-sam", "Deudas Sam", "Pago mensual", 60, "cat-debt", "2026-01-01", 1),
    template("exp-parking", "Parking", "Garaje", 30, "cat-vehicle", "2026-01-01", 1),
    template("exp-gasolina", "Gasolina", "Estimacion mensual", 65, "cat-vehicle", "2026-01-01", 1),
    template("exp-transport-pass", "Bono transporte", "Tranvia y bus", 40, "cat-transport", "2026-01-03", 3),
    template("exp-1password", "1Password", "Password manager", 4, "cat-subscriptions", "2026-01-15", 15),
    template("exp-icloud", "iCloud", "Almacenamiento", 3.99, "cat-subscriptions", "2026-01-15", 15),
    template("exp-dazn", "Dazn", "Deportes", 15, "cat-subscriptions", "2026-01-15", 15),
    template("exp-macrofactor", "Macrofactor", "App nutricion", 12, "cat-health", "2026-01-10", 10),
    template("exp-codex", "Codex", "AI coding", 90, "cat-work", "2026-01-06", 6),
    template("exp-youtube", "YouTube", "Premium", 15, "cat-subscriptions", "2026-01-02", 2),
    template("exp-el-corte-ingles", "El Corte Ingles", "Compra financiada", 90, "cat-debt", "2026-01-01", 1),
    template("exp-netflix", "Netflix", "Streaming", 25, "cat-subscriptions", "2026-01-01", 1),
    template("exp-gym", "Gym", "Gimnasio", 50, "cat-sport", "2026-01-01", 1),
    {
      ...template("exp-car-insurance", "Seguro coche", "Seguro anual del coche", 148.5, "cat-vehicle", "2026-05-18", 18),
      recurrence: { frequency: "yearly", annualMonth: 5 },
    },
  ],
  overrides: [
    paid("ovr-home-expenses-jun", "exp-home-expenses", "2026-06-01", 660),
    paid("ovr-food-jun", "exp-food", "2026-06-02", 260),
    paid("ovr-macrofactor-jun", "exp-macrofactor", "2026-06-10", 12),
    paid("ovr-codex-jun", "exp-codex", "2026-06-06", 90),
    paid("ovr-youtube-jun", "exp-youtube", "2026-06-02", 15),
    paid("ovr-el-corte-ingles-jun", "exp-el-corte-ingles", "2026-06-01", 90),
    paid("ovr-netflix-jun", "exp-netflix", "2026-06-01", 25),
    paid("ovr-gym-jun", "exp-gym", "2026-06-01", 50),
  ],
  finance: defaultFinanceStore,
  bankMovements: [],
  bankMerchantAliases: [
    {
      id: "alias-apple-icloud",
      userId: "demo",
      merchantKey: "apple",
      templateId: "exp-icloud",
      label: "APPLE",
      createdAt: "2026-01-01T09:00:00.000Z",
      updatedAt: "2026-01-01T09:00:00.000Z",
    },
  ],
  deleted: {
    categories: [],
    templates: [],
    overrides: [],
    incomeEvents: [],
    bankMovements: [],
    bankMerchantAliases: [],
  },
  preferences: {
    theme: "vice-afterglow",
    language: "es",
  },
};

function category(
  id: string,
  name: string,
  icon: string,
  tone: ExpenseCategory["tone"],
): ExpenseCategory {
  return {
    id,
    userId: "demo",
    name,
    icon,
    tone,
  };
}

function template(
  id: string,
  name: string,
  description: string,
  amount: number,
  categoryId: string,
  startDate: string,
  dueDay: number,
): ExpenseTemplate {
  return {
    id,
    userId: "demo",
    name,
    description,
    amount,
    currency: "EUR",
    categoryId,
    startDate,
    dueDay,
    recurrence: { frequency: "monthly" },
    active: true,
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-01-01T09:00:00.000Z",
  };
}

function paid(
  id: string,
  templateId: string,
  occurrenceDate: string,
  amountPaid: number,
) {
  return {
    id,
    userId: "demo",
    templateId,
    occurrenceDate,
    status: "paid" as const,
    paidAt: `${occurrenceDate}T12:00:00.000Z`,
    amountPaid,
  };
}
