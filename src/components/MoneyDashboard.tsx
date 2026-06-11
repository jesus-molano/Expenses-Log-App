"use client";

import { FormEvent, useMemo, useState } from "react";
import { endOfMonth, startOfMonth } from "date-fns";
import { Landmark, PiggyBank, Plus, Settings2, WalletCards } from "lucide-react";
import { formatCurrency, toDateOnly } from "@/domain/calendar";
import { buildMonthlyMoneyPlan } from "@/domain/finance";
import { generateOccurrences } from "@/domain/recurrence";
import { DashboardShell } from "@/features/expenses/components/DashboardShell";
import { useExpenseStore } from "@/features/expenses/hooks/use-expense-store";
import { useScrollChrome } from "@/features/expenses/hooks/use-scroll-chrome";

type MoneyDashboardProps = {
  userEmail?: string | null;
  isCloudReady?: boolean;
};

export function MoneyDashboard({
  userEmail = null,
  isCloudReady = false,
}: MoneyDashboardProps) {
  const {
    store,
    updateMoneySettings,
    addIncomeEvent,
  } = useExpenseStore();
  useScrollChrome();

  const today = useMemo(() => new Date(), []);
  const salary = store.finance.incomeSources.find(
    (source) => source.id === "inc-salary",
  );
  const [salaryAmount, setSalaryAmount] = useState(
    formatMoneyInput(salary?.amount ?? 0),
  );
  const [salaryDay, setSalaryDay] = useState(salary?.dayOfMonth ?? 28);
  const [savingsTarget, setSavingsTarget] = useState(
    formatMoneyInput(store.finance.allocation.monthlySavingsTarget),
  );
  const [accountNames, setAccountNames] = useState({
    sabadellAccountName: store.finance.allocation.sabadellAccountName,
    bbvaSavingsAccountName: store.finance.allocation.bbvaSavingsAccountName,
    bbvaMainAccountName: store.finance.allocation.bbvaMainAccountName,
  });
  const [extraName, setExtraName] = useState("Bizum");
  const [extraAmount, setExtraAmount] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);

  function openSettings() {
    setSalaryAmount(formatMoneyInput(salary?.amount ?? 0));
    setSalaryDay(salary?.dayOfMonth ?? 28);
    setSavingsTarget(formatMoneyInput(store.finance.allocation.monthlySavingsTarget));
    setAccountNames({
      sabadellAccountName: store.finance.allocation.sabadellAccountName,
      bbvaSavingsAccountName: store.finance.allocation.bbvaSavingsAccountName,
      bbvaMainAccountName: store.finance.allocation.bbvaMainAccountName,
    });
    setDayPickerOpen(false);
    setSettingsOpen(true);
  }

  const occurrences = useMemo(
    () =>
      generateOccurrences(
        store.templates,
        store.overrides,
        toDateOnly(startOfMonth(today)),
        toDateOnly(endOfMonth(today)),
      ),
    [store.templates, store.overrides, today],
  );
  const plan = buildMonthlyMoneyPlan({
    monthDate: today,
    finance: store.finance,
    occurrences,
  });

  function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateMoneySettings({
      salaryAmount: parseMoneyInput(salaryAmount),
      salaryDay,
      savingsTarget: parseMoneyInput(savingsTarget),
      ...accountNames,
    });
    setDayPickerOpen(false);
    setSettingsOpen(false);
  }

  function saveExtra(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (extraAmount <= 0) return;

    addIncomeEvent({
      name: extraName,
      amount: extraAmount,
      receivedAt: toDateOnly(today),
    });
    setExtraName("Bizum");
    setExtraAmount(0);
  }

  return (
    <DashboardShell
      headlineLabel={formatCurrency(plan.bbvaMainContribution)}
      headlineTitle={plan.shortfall > 0 ? "Falta cubrir" : "Libre este mes"}
      activeTab="money"
      userEmail={userEmail}
      isCloudReady={isCloudReady}
    >
      <section className="grid gap-3 pb-8 pt-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-300">
              Ingresos {formatCurrency(plan.incomeTotal)}
            </p>
            <h1 className="text-xl font-semibold text-white">Reparto del mes</h1>
          </div>
          <button
            type="button"
            onClick={openSettings}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-white/10"
          >
            <Settings2 size={17} />
            Configurar
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <MoneyCard
            icon={<WalletCards size={18} />}
            label={store.finance.allocation.sabadellAccountName}
            value={formatCurrency(plan.sabadellContribution)}
            detail={`Gastos: ${formatCurrency(plan.fixedExpensesTotal)}`}
          />
          <MoneyCard
            icon={<PiggyBank size={18} />}
            label={store.finance.allocation.bbvaSavingsAccountName}
            value={formatCurrency(plan.bbvaSavingsContribution)}
            detail={`Objetivo: ${formatCurrency(store.finance.allocation.monthlySavingsTarget)}`}
          />
          <MoneyCard
            icon={<Landmark size={18} />}
            label={store.finance.allocation.bbvaMainAccountName}
            value={formatCurrency(plan.bbvaMainContribution)}
            detail="Comidas, salidas y caprichos"
          />
        </div>

        {plan.shortfall > 0 ? (
          <div className="rounded-2xl border border-orange-300/25 bg-orange-400/12 px-4 py-3 text-sm font-semibold text-orange-100">
            Faltan {formatCurrency(plan.shortfall)} para cubrir los gastos del mes.
          </div>
        ) : null}

        <form
          onSubmit={saveExtra}
          className="rounded-[1.35rem] border border-white/10 bg-slate-950/72 p-4"
        >
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Plus size={18} />
            Ingreso puntual
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            Extras este mes: {formatCurrency(plan.extraIncomeTotal)}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_7rem]">
            <input
              value={extraName}
              onChange={(event) => setExtraName(event.target.value)}
              className="input-control"
              placeholder="Bizum, renta..."
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={extraAmount}
              onChange={(event) => setExtraAmount(Number(event.target.value))}
              className="input-control"
            />
          </div>
          <button className="mt-3 h-12 w-full rounded-2xl bg-white/10 text-sm font-semibold text-white ring-1 ring-white/10">
            Añadir ingreso
          </button>
        </form>
      </section>

      {settingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6">
          <form
            onSubmit={savePlan}
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.65rem] border border-white/10 bg-slate-950 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.55)] sm:max-w-xl sm:rounded-[1.65rem]"
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/20 sm:hidden" />
            <header className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Configurar dinero
                </h2>
                <p className="text-sm text-slate-300">
                  Bancos, sueldo y objetivo de ahorro.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="h-10 rounded-full px-3 text-sm font-medium text-slate-200 hover:bg-white/10"
              >
                Cerrar
              </button>
            </header>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MoneyField label="Sueldo">
                <input
                  value={salaryAmount}
                  inputMode="decimal"
                  placeholder="2.200,00"
                  onChange={(event) => setSalaryAmount(event.target.value)}
                  className="input-control"
                />
              </MoneyField>
              <MoneyField label="Día de cobro">
                <button
                  type="button"
                  onClick={() => setDayPickerOpen((open) => !open)}
                  className="input-control flex items-center justify-between text-left"
                  aria-expanded={dayPickerOpen}
                  aria-label={`Cambiar dia de cobro, dia ${salaryDay}`}
                >
                  <span>Día {salaryDay}</span>
                  <span className="text-xs font-semibold text-lime-200">
                    Cambiar
                  </span>
                </button>
                {dayPickerOpen ? (
                  <div className="rounded-[1rem] border border-white/10 bg-white/[0.045] p-2 shadow-[0_18px_45px_rgba(0,0,0,0.34)]">
                    <div className="grid grid-cols-7 gap-1">
                      {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            setSalaryDay(day);
                            setDayPickerOpen(false);
                          }}
                          className={`grid h-9 place-items-center rounded-xl text-sm font-semibold transition ${
                            day === salaryDay
                              ? "bg-lime-300 text-slate-950 shadow-[0_0_20px_rgba(190,242,100,0.22)]"
                              : "bg-white/[0.055] text-slate-100 hover:bg-white/10"
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </MoneyField>
              <MoneyField label="Ahorro mensual">
                <input
                  value={savingsTarget}
                  inputMode="decimal"
                  placeholder="300,00"
                  onChange={(event) => setSavingsTarget(event.target.value)}
                  className="input-control"
                />
              </MoneyField>
              <MoneyField label="Cuenta gastos">
                <input
                  value={accountNames.sabadellAccountName}
                  onChange={(event) =>
                    setAccountNames({
                      ...accountNames,
                      sabadellAccountName: event.target.value,
                    })
                  }
                  className="input-control"
                />
              </MoneyField>
              <MoneyField label="Cuenta ahorro">
                <input
                  value={accountNames.bbvaSavingsAccountName}
                  onChange={(event) =>
                    setAccountNames({
                      ...accountNames,
                      bbvaSavingsAccountName: event.target.value,
                    })
                  }
                  className="input-control"
                />
              </MoneyField>
              <MoneyField label="Cuenta principal">
                <input
                  value={accountNames.bbvaMainAccountName}
                  onChange={(event) =>
                    setAccountNames({
                      ...accountNames,
                      bbvaMainAccountName: event.target.value,
                    })
                  }
                  className="input-control"
                />
              </MoneyField>
            </div>
            <button className="mt-5 h-12 w-full rounded-2xl bg-lime-300 text-sm font-semibold text-slate-950">
              Guardar configuración
            </button>
          </form>
        </div>
      ) : null}
    </DashboardShell>
  );
}

function MoneyField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-200">
      {label}
      {children}
    </label>
  );
}

function MoneyCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-[1.25rem] border border-white/10 bg-slate-900/82 p-4 shadow-[0_14px_42px_rgba(0,0,0,0.32)]">
      <div className="flex items-center gap-2 text-sm font-semibold text-lime-100">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs font-medium text-slate-300">{detail}</p>
    </article>
  );
}

function formatMoneyInput(value: number) {
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function parseMoneyInput(value: string) {
  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}
