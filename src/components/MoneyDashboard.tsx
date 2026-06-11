"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { enUS, es } from "date-fns/locale";
import {
  Landmark,
  PiggyBank,
  Plus,
  Settings2,
  WalletCards,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CompactMenu } from "@/components/ui/CompactMenu";
import { formatCurrency, toDateOnly } from "@/domain/calendar";
import { buildMonthlyMoneyPlan, isEventInMonth } from "@/domain/finance";
import { generateOccurrences } from "@/domain/recurrence";
import type { ExpenseOccurrence } from "@/domain/types";
import { DashboardShell } from "@/features/expenses/components/DashboardShell";
import { useExpenseStore } from "@/features/expenses/hooks/use-expense-store";
import { useScrollChrome } from "@/features/expenses/hooks/use-scroll-chrome";
import { categoryLabel } from "@/lib/category-labels";
import { t } from "@/lib/i18n";

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
    deleteIncomeEvent,
  } = useExpenseStore();
  useScrollChrome();
  const language = store.preferences?.language ?? "es";

  const today = useMemo(() => new Date(), []);
  const salary = store.finance.incomeSources.find(
    (source) => source.id === "inc-salary",
  );
  const [salaryAmount, setSalaryAmount] = useState(
    formatMoneyInput(salary?.amount ?? 0, language),
  );
  const [salaryDay, setSalaryDay] = useState(salary?.dayOfMonth ?? 28);
  const [savingsTarget, setSavingsTarget] = useState(
    formatMoneyInput(store.finance.allocation.monthlySavingsTarget, language),
  );
  const [accountNames, setAccountNames] = useState({
    expensesAccountName: store.finance.allocation.expensesAccountName,
    savingsAccountName: store.finance.allocation.savingsAccountName,
    primaryAccountName: store.finance.allocation.primaryAccountName,
  });
  const [extraName, setExtraName] = useState("Bizum");
  const [extraAmount, setExtraAmount] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  const [isCompactChart, setIsCompactChart] = useState(false);
  const [selectedExpensesExpanded, setSelectedExpensesExpanded] = useState(false);
  const [selectedYear, setSelectedYear] = useState(() =>
    new Date().getFullYear(),
  );
  const [selectedMonth, setSelectedMonth] = useState(() =>
    toDateOnly(startOfMonth(new Date())),
  );

  function openSettings() {
    setSalaryAmount(formatMoneyInput(salary?.amount ?? 0, language));
    setSalaryDay(salary?.dayOfMonth ?? 28);
    setSavingsTarget(formatMoneyInput(
      store.finance.allocation.monthlySavingsTarget,
      language,
    ));
    setAccountNames({
      expensesAccountName: store.finance.allocation.expensesAccountName,
      savingsAccountName: store.finance.allocation.savingsAccountName,
      primaryAccountName: store.finance.allocation.primaryAccountName,
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
  const moneySeries = useMemo(() => {
    const locale = language === "en" ? enUS : es;
    const currentMonthId = toDateOnly(startOfMonth(today));

    return Array.from({ length: 12 }, (_, index) => {
      const monthDate = new Date(selectedYear, index, 1);
      const monthOccurrences = generateOccurrences(
        store.templates,
        store.overrides,
        toDateOnly(startOfMonth(monthDate)),
        toDateOnly(endOfMonth(monthDate)),
      );
      const monthPlan = buildMonthlyMoneyPlan({
        monthDate,
        finance: store.finance,
        occurrences: monthOccurrences,
      });

      const oneOffEvents = store.finance.incomeEvents.filter((event) =>
        isEventInMonth(event, monthDate),
      );
      const monthId = toDateOnly(startOfMonth(monthDate));
      const isCurrentMonth = monthId === currentMonthId;
      const isPastOrCurrentMonth = monthId <= currentMonthId;
      const hasRecords =
        (isPastOrCurrentMonth &&
          (monthPlan.fixedExpensesTotal > 0 || oneOffEvents.length > 0)) ||
        isCurrentMonth;

      return {
        id: monthId,
        month: format(monthDate, "MMM", { locale }),
        monthLong: format(monthDate, "MMMM yyyy", { locale }),
        income: monthPlan.incomeTotal,
        expenses: monthPlan.fixedExpensesTotal,
        free: monthPlan.primaryContribution,
        savings: monthPlan.savingsContribution,
        shortfall: monthPlan.shortfall,
        hasRecords,
      };
    }).filter((item) => item.hasRecords);
  }, [language, selectedYear, store.finance, store.overrides, store.templates, today]);
  const availableYears = useMemo(() => {
    const years = new Set<number>([today.getFullYear()]);
    for (const template of store.templates) {
      years.add(new Date(`${template.startDate}T00:00:00`).getFullYear());
    }
    for (const event of store.finance.incomeEvents) {
      years.add(new Date(`${event.receivedAt}T00:00:00`).getFullYear());
    }
    for (const override of store.overrides) {
      years.add(
        new Date(`${override.dueDate ?? override.occurrenceDate}T00:00:00`).getFullYear(),
      );
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [store.finance.incomeEvents, store.overrides, store.templates, today]);
  const effectiveSelectedMonth =
    moneySeries.some((item) => item.id === selectedMonth)
      ? selectedMonth
      : moneySeries.at(-1)?.id;
  const selectedMonthSummary =
    moneySeries.find((item) => item.id === effectiveSelectedMonth) ?? {
      id: toDateOnly(startOfMonth(today)),
      month: format(today, "MMM", { locale: language === "en" ? enUS : es }),
      monthLong: format(today, "MMMM yyyy", { locale: language === "en" ? enUS : es }),
      income: 0,
      expenses: 0,
      free: 0,
      savings: 0,
      shortfall: 0,
      hasRecords: true,
    };
  const selectedMonthDate = useMemo(
    () => new Date(`${selectedMonthSummary.id}T00:00:00`),
    [selectedMonthSummary.id],
  );
  const selectedMonthIncomeEvents = store.finance.incomeEvents.filter((event) =>
    isEventInMonth(event, selectedMonthDate),
  );
  const selectedMonthOccurrences = useMemo(
    () =>
      generateOccurrences(
        store.templates,
        store.overrides,
        toDateOnly(startOfMonth(selectedMonthDate)),
        toDateOnly(endOfMonth(selectedMonthDate)),
      ),
    [selectedMonthDate, store.overrides, store.templates],
  );
  const visibleSelectedMonthOccurrences = selectedExpensesExpanded
    ? selectedMonthOccurrences
    : selectedMonthOccurrences.slice(0, 6);
  const annualOccurrences = useMemo(() => {
    const year = today.getFullYear();

    return generateOccurrences(
      store.templates,
      store.overrides,
      `${year}-01-01`,
      `${year}-12-31`,
    );
  }, [store.overrides, store.templates, today]);
  const annualExpensesTotal = annualOccurrences.reduce(
    (sum, occurrence) => sum + occurrence.template.amount,
    0,
  );
  const annualSavingsEstimate =
    store.finance.allocation.monthlySavingsTarget * 12 +
    store.finance.incomeEvents
      .filter((event) => event.receivedAt.startsWith(String(today.getFullYear())))
      .reduce((sum, event) => sum + event.amount, 0);
  const monthlyIncomeEvents = store.finance.incomeEvents.filter((event) =>
    isEventInMonth(event, today),
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 520px)");
    const update = () => setIsCompactChart(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

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
    const amount = parseMoneyInput(extraAmount);
    if (amount <= 0) return;

    addIncomeEvent({
      name: extraName,
      amount,
      receivedAt: toDateOnly(today),
    });
    setExtraName("Bizum");
    setExtraAmount("");
  }

  return (
    <DashboardShell
      headlineLabel={formatCurrency(plan.primaryContribution)}
      headlineTitle={
        plan.shortfall > 0
          ? t("common.shortfall", language)
          : t("common.freeThisMonth", language)
      }
      activeTab="money"
      userEmail={userEmail}
      isCloudReady={isCloudReady}
      language={language}
    >
      <section className="grid w-full min-w-0 max-w-full gap-3 overflow-hidden pb-8 pt-2">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-300">
              {t("money.income", language)} {formatCurrency(plan.incomeTotal)}
            </p>
            <h1 className="text-xl font-semibold text-white">
              {t("money.monthlyPlan", language)}
            </h1>
          </div>
          <button
            type="button"
            onClick={openSettings}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-white/10 px-3 text-sm font-semibold text-white ring-1 ring-white/10 sm:px-4"
          >
            <Settings2 size={17} />
            <span className="hidden sm:inline">{t("money.configure", language)}</span>
          </button>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-3">
          <MoneyCard
            icon={<WalletCards size={18} />}
            label={store.finance.allocation.expensesAccountName}
            value={formatCurrency(plan.expensesContribution)}
            detail={`${t("money.expensesPrefix", language)}: ${formatCurrency(plan.fixedExpensesTotal)}`}
          />
          <MoneyCard
            icon={<PiggyBank size={18} />}
            label={store.finance.allocation.savingsAccountName}
            value={formatCurrency(plan.savingsContribution)}
            detail={`${t("money.targetPrefix", language)}: ${formatCurrency(store.finance.allocation.monthlySavingsTarget)}`}
          />
          <MoneyCard
            icon={<Landmark size={18} />}
            label={store.finance.allocation.primaryAccountName}
            value={formatCurrency(plan.primaryContribution)}
            detail={t("money.discretionary", language)}
          />
        </div>

        {plan.shortfall > 0 ? (
          <div className="rounded-2xl border border-orange-300/25 bg-orange-400/12 px-4 py-3 text-sm font-semibold text-orange-100">
            {t("common.shortfall", language)} {formatCurrency(plan.shortfall)}{" "}
            {t("money.shortfallMessage", language)}
          </div>
        ) : null}

        <section className="order-3 min-w-0 overflow-hidden rounded-[1.35rem] border border-white/10 bg-slate-950/72 p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {t("money.trendTitle", language)}
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                {t("money.trendSubtitle", language)}
              </p>
            </div>
          </div>
          <div className="mt-4 h-44 min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={moneySeries}
                margin={
                  isCompactChart
                    ? { top: 4, right: 2, bottom: 0, left: 2 }
                    : { top: 4, right: 4, bottom: 0, left: 4 }
                }
              >
                <CartesianGrid
                  stroke="var(--app-border)"
                  strokeDasharray="3 6"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--app-text-muted)", fontSize: 12 }}
                />
                {isCompactChart ? null : (
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--app-text-muted)", fontSize: 11 }}
                    tickFormatter={(value) => compactMoneyAxis(Number(value))}
                    width={48}
                  />
                )}
                <Tooltip
                  cursor={{ fill: "var(--app-panel-soft-alpha)" }}
                  contentStyle={{
                    background: "var(--app-surface)",
                    border: "1px solid var(--app-border)",
                    borderRadius: "14px",
                    color: "var(--app-text)",
                  }}
                  formatter={(value, name) => [
                    formatCurrency(Number(value)),
                    String(name),
                  ]}
                />
                <Bar
                  dataKey="income"
                  name={t("money.income", language)}
                  fill="var(--app-accent-2)"
                  radius={[8, 8, 2, 2]}
                />
                <Bar
                  dataKey="expenses"
                  name={t("money.fixedExpenses", language)}
                  fill="var(--app-warning)"
                  radius={[8, 8, 2, 2]}
                />
                <Bar
                  dataKey="free"
                  name={t("money.free", language)}
                  fill="var(--app-accent)"
                  radius={[8, 8, 2, 2]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MoneyStat
              label={t("money.annualExpenses", language)}
              value={formatCurrency(annualExpensesTotal)}
            />
            <MoneyStat
              label={t("money.annualSavingsEstimate", language)}
              value={formatCurrency(annualSavingsEstimate)}
            />
          </div>
          <div className="mt-4 rounded-[1.15rem] border border-white/10 bg-white/[0.035] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {t("money.compareMonths", language)}
                </h3>
                <p className="mt-0.5 text-xs font-medium capitalize text-slate-300">
                  {selectedMonthSummary.monthLong}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-[0.8fr_1.2fr] gap-2">
              <div className="grid min-w-0 gap-1 text-xs font-semibold text-slate-300">
                {t("money.year", language)}
                <CompactMenu
                  open={yearMenuOpen}
                  onOpenChange={setYearMenuOpen}
                  label={String(selectedYear)}
                  align="left"
                >
                  {availableYears.map((year) => (
                    <button
                      key={year}
                      type="button"
                      onClick={() => {
                        setSelectedYear(year);
                        setSelectedMonth(`${year}-01-01`);
                        setYearMenuOpen(false);
                      }}
                      className={`flex h-9 w-full items-center rounded-xl px-3 text-left text-sm font-semibold ${
                        selectedYear === year
                          ? "bg-lime-300 text-slate-950"
                          : "text-white hover:bg-white/10"
                      }`}
                    >
                      {year}
                    </button>
                  ))}
                </CompactMenu>
              </div>
              <div className="grid min-w-0 gap-1 text-xs font-semibold text-slate-300">
                {t("money.month", language)}
                <CompactMenu
                  open={monthMenuOpen}
                  onOpenChange={setMonthMenuOpen}
                  label={selectedMonthSummary.monthLong}
                >
                {moneySeries.length ? (
                  moneySeries.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                      onClick={() => {
                        setSelectedMonth(item.id);
                        setSelectedExpensesExpanded(false);
                        setMonthMenuOpen(false);
                      }}
                        className={`flex h-9 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm font-semibold ${
                          selectedMonthSummary.id === item.id
                            ? "bg-lime-300 text-slate-950"
                            : "text-white hover:bg-white/10"
                        }`}
                      >
                        <span className="truncate capitalize">{item.monthLong}</span>
                        <span>{formatCurrency(item.free)}</span>
                      </button>
                    ))
                  ) : (
                    <span className="px-3 py-2 text-sm text-slate-300">
                      {t("money.noMonthsWithData", language)}
                    </span>
                  )}
                </CompactMenu>
              </div>
            </div>
            {!moneySeries.length ? (
              <p className="mt-3 rounded-2xl bg-white/[0.035] px-3 py-2 text-sm font-medium text-slate-300 ring-1 ring-white/10">
                {t("money.noMonthsWithData", language)}
              </p>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MoneyStat
                label={t("money.income", language)}
                value={formatCurrency(selectedMonthSummary.income)}
              />
              <MoneyStat
                label={t("money.fixedExpenses", language)}
                value={formatCurrency(selectedMonthSummary.expenses)}
              />
              <MoneyStat
                label={t("money.savings", language)}
                value={formatCurrency(selectedMonthSummary.savings)}
              />
              <MoneyStat
                label={
                  selectedMonthSummary.shortfall > 0
                    ? t("common.shortfall", language)
                    : t("money.free", language)
                }
                value={formatCurrency(
                  selectedMonthSummary.shortfall > 0
                    ? selectedMonthSummary.shortfall
                    : selectedMonthSummary.free,
                )}
              />
            </div>
            <div className="mt-3">
              <h4 className="text-sm font-semibold text-white">
                {t("money.oneOffForMonth", language)}
              </h4>
              <div className="mt-2 grid gap-2">
                {selectedMonthIncomeEvents.length ? (
                  selectedMonthIncomeEvents.map((event) => (
                    <IncomeEventRow
                      key={event.id}
                      name={event.name}
                      date={event.receivedAt}
                      amount={formatCurrency(event.amount)}
                      removeLabel={t("money.removeIncome", language)}
                      onRemove={() => deleteIncomeEvent(event.id)}
                    />
                  ))
                ) : (
                  <p className="rounded-2xl bg-white/[0.035] px-3 py-2 text-sm font-medium text-slate-300 ring-1 ring-white/10">
                    {t("money.noOneOffForMonth", language)}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-white">
                {t("money.monthExpenses", language)}
              </h4>
              <div className="mt-2 grid gap-2">
                {visibleSelectedMonthOccurrences.length ? (
                  visibleSelectedMonthOccurrences.map((occurrence) => (
                    <MonthlyExpenseRow
                      key={occurrence.id}
                      occurrence={occurrence}
                      categoryName={
                        store.categories.find(
                          (category) => category.id === occurrence.template.categoryId,
                        )?.name ?? "General"
                      }
                      language={language}
                      today={toDateOnly(today)}
                    />
                  ))
                ) : (
                  <p className="rounded-2xl bg-white/[0.035] px-3 py-2 text-sm font-medium text-slate-300 ring-1 ring-white/10">
                    {t("money.noExpensesForMonth", language)}
                  </p>
                )}
              </div>
              {selectedMonthOccurrences.length > 6 ? (
                <button
                  type="button"
                  onClick={() => setSelectedExpensesExpanded((expanded) => !expanded)}
                  className="mt-2 h-9 w-full rounded-2xl bg-white/[0.055] text-sm font-semibold text-white ring-1 ring-white/10"
                >
                  {selectedExpensesExpanded
                    ? t("money.showLessExpenses", language)
                    : `${t("money.showAllExpenses", language)} (${selectedMonthOccurrences.length})`}
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <form
          onSubmit={saveExtra}
          className="order-2 rounded-[1.35rem] border border-white/10 bg-slate-950/72 p-3 sm:p-4"
        >
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Plus size={18} />
            {t("money.oneOffIncome", language)}
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            {t("money.extrasThisMonth", language)}:{" "}
            {formatCurrency(plan.extraIncomeTotal)}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_7rem]">
            <input
              value={extraName}
              onChange={(event) => setExtraName(event.target.value)}
              className="input-control"
              placeholder={t("money.extraNamePlaceholder", language)}
            />
            <input
              value={extraAmount}
              inputMode="decimal"
              onChange={(event) => setExtraAmount(event.target.value)}
              className="input-control"
              placeholder={t("money.extraAmountPlaceholder", language)}
            />
          </div>
          <button className="mt-3 h-12 w-full rounded-2xl bg-white/10 text-sm font-semibold text-white ring-1 ring-white/10">
            {t("money.addIncome", language)}
          </button>
          <div className="mt-4 grid gap-2">
            {monthlyIncomeEvents.length ? (
              monthlyIncomeEvents.map((event) => (
                <IncomeEventRow
                  key={event.id}
                  name={event.name}
                  date={event.receivedAt}
                  amount={formatCurrency(event.amount)}
                  removeLabel={t("money.removeIncome", language)}
                  onRemove={() => deleteIncomeEvent(event.id)}
                />
              ))
            ) : (
              <p className="rounded-2xl bg-white/[0.035] px-3 py-2 text-sm font-medium text-slate-300 ring-1 ring-white/10">
                {t("money.noExtraIncome", language)}
              </p>
            )}
          </div>
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
                  {t("money.configureMoney", language)}
                </h2>
                <p className="text-sm text-slate-300">
                  {t("money.configureMoneySubtitle", language)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="h-10 rounded-full px-3 text-sm font-medium text-slate-200 hover:bg-white/10"
              >
                {t("money.close", language)}
              </button>
            </header>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MoneyField label={t("money.salary", language)}>
                <input
                  value={salaryAmount}
                  inputMode="decimal"
                  placeholder="2.200,00"
                  onChange={(event) => setSalaryAmount(event.target.value)}
                  className="input-control"
                />
              </MoneyField>
              <MoneyField label={t("money.payday", language)}>
                <button
                  type="button"
                  onClick={() => setDayPickerOpen((open) => !open)}
                  className="input-control flex items-center justify-between text-left"
                  aria-expanded={dayPickerOpen}
                  aria-label={`${t("money.changePaydayLabel", language)}, ${salaryDay}`}
                >
                  <span>{t("money.payday", language)} {salaryDay}</span>
                  <span className="text-xs font-semibold text-lime-200">
                    {t("money.changePayday", language)}
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
              <MoneyField label={t("money.monthlySavings", language)}>
                <input
                  value={savingsTarget}
                  inputMode="decimal"
                  placeholder="300,00"
                  onChange={(event) => setSavingsTarget(event.target.value)}
                  className="input-control"
                />
              </MoneyField>
              <MoneyField label={t("money.expensesAccount", language)}>
                <input
                  value={accountNames.expensesAccountName}
                  onChange={(event) =>
                    setAccountNames({
                      ...accountNames,
                      expensesAccountName: event.target.value,
                    })
                  }
                  className="input-control"
                />
              </MoneyField>
              <MoneyField label={t("money.savingsAccount", language)}>
                <input
                  value={accountNames.savingsAccountName}
                  onChange={(event) =>
                    setAccountNames({
                      ...accountNames,
                      savingsAccountName: event.target.value,
                    })
                  }
                  className="input-control"
                />
              </MoneyField>
              <MoneyField label={t("money.mainAccount", language)}>
                <input
                  value={accountNames.primaryAccountName}
                  onChange={(event) =>
                    setAccountNames({
                      ...accountNames,
                      primaryAccountName: event.target.value,
                    })
                  }
                  className="input-control"
                />
              </MoneyField>
            </div>
            <button className="mt-5 h-12 w-full rounded-2xl bg-lime-300 text-sm font-semibold text-slate-950">
              {t("money.saveSettings", language)}
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
    <article className="min-w-0 overflow-hidden rounded-[1.15rem] border border-white/10 bg-slate-900/82 p-3 shadow-[0_14px_42px_rgba(0,0,0,0.32)] sm:p-4">
      <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-lime-100">
        {icon}
        <span className="min-w-0 truncate">{label}</span>
      </div>
      <p className="mt-2 truncate text-[22px] font-semibold leading-tight text-white sm:mt-3 sm:text-2xl">
        {value}
      </p>
      <p className="mt-1 truncate text-xs font-medium text-slate-300">{detail}</p>
    </article>
  );
}

function MoneyStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/[0.045] px-3 py-2 ring-1 ring-white/10">
      <p className="text-xs font-medium text-slate-300">{label}</p>
      <p className="mt-1 truncate text-base font-semibold text-white">{value}</p>
    </div>
  );
}

function IncomeEventRow({
  name,
  date,
  amount,
  removeLabel,
  onRemove,
}: {
  name: string;
  date: string;
  amount: string;
  removeLabel: string;
  onRemove: () => void;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-2xl bg-white/[0.045] px-3 py-2 ring-1 ring-white/10">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{name}</p>
        <p className="text-xs font-medium text-slate-300">{date}</p>
      </div>
      <p className="text-sm font-semibold text-white">{amount}</p>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="grid size-8 place-items-center rounded-full bg-white/8 text-sm font-semibold text-slate-200 ring-1 ring-white/10"
      >
        <X size={15} />
      </button>
    </div>
  );
}

function MonthlyExpenseRow({
  occurrence,
  categoryName,
  language,
  today,
}: {
  occurrence: ExpenseOccurrence;
  categoryName: string;
  language: "es" | "en";
  today: string;
}) {
  const locale = language === "en" ? enUS : es;
  const isPaid = occurrence.status === "paid";
  const isOverdue = occurrence.status !== "paid" && occurrence.dueDate < today;
  const status = isPaid
    ? t("common.paid", language)
    : isOverdue
      ? t("expenses.overdue", language)
      : t("common.pending", language);

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-white/[0.045] px-3 py-2 ring-1 ring-white/10">
      <div className="min-w-0">
        <p className={`truncate text-sm font-semibold ${isPaid ? "text-slate-300 line-through" : "text-white"}`}>
          {occurrence.template.name}
        </p>
        <p className="mt-0.5 truncate text-xs font-medium text-slate-300">
          {format(new Date(`${occurrence.dueDate}T00:00:00`), "d MMM", { locale })} ·{" "}
          {categoryLabel(categoryName, language)} · {status}
        </p>
      </div>
      <p className={`text-sm font-semibold ${isPaid ? "text-slate-300 line-through" : "text-white"}`}>
        {formatCurrency(occurrence.template.amount)}
      </p>
    </div>
  );
}

function formatMoneyInput(value: number, language: "es" | "en") {
  return new Intl.NumberFormat(language === "en" ? "en-US" : "es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function parseMoneyInput(value: string) {
  const clean = value.trim().replace(/\s/g, "");
  const commaIndex = clean.lastIndexOf(",");
  const dotIndex = clean.lastIndexOf(".");
  const decimalSeparator =
    commaIndex > dotIndex ? "," : dotIndex > commaIndex ? "." : null;
  const normalized = decimalSeparator
    ? clean
        .replace(new RegExp(`\\${decimalSeparator === "," ? "." : ","}`, "g"), "")
        .replace(decimalSeparator, ".")
    : clean;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}

function compactMoneyAxis(value: number) {
  if (Math.abs(value) >= 1000) {
    return `${Math.round(value / 100) / 10}k`;
  }

  return String(Math.round(value));
}
