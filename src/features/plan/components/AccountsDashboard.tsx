"use client";

import { ActionToast } from "@/components/ui/ActionToast";
import { DashboardShell } from "@/features/expenses/components/DashboardShell";
import { useActionToast } from "@/features/expenses/hooks/use-action-toast";
import { useScrollChrome } from "@/features/expenses/hooks/use-scroll-chrome";
import { formatMessage, t } from "@/shared/i18n";
import { useExpenseStore } from "@/stores/app/use-expense-store";
import { useAccountEditor } from "../hooks/use-account-editor";
import { useAccountSummaries } from "../hooks/use-account-summaries";
import { useActiveBudgetMonth } from "../hooks/use-active-budget-month";
import { useBalanceCheckinForm } from "../hooks/use-balance-checkin-form";
import { accountDisplayName } from "../lib/account-labels";
import { accountsHeadline } from "../lib/accounts-headline";
import type { BalanceEntry } from "../lib/balance-log";
import { formatShortDate } from "../lib/plan-dashboard";
import { AccountEditorSheet } from "./AccountEditorSheet";
import { AccountsSection } from "./AccountsSection";
import { BalanceCheckinSheet } from "./BalanceCheckinSheet";
import { DeleteAccountDialog } from "./DeleteAccountDialog";

// Pestaña Cuentas (/accounts): el saldo de cada cuenta y si la de los recibos
// llega a lo que queda por pagar en el mes activo.
export function AccountsDashboard() {
  const {
    store,
    addBalanceAccount,
    updateBalanceAccount,
    moveBalanceAccount,
    deleteBalanceAccount,
    recordAccountBalance,
    deleteAccountBalance,
  } = useExpenseStore();
  const chrome = useScrollChrome();
  const { language, todayDateOnly, activeMonthId, cycle } = useActiveBudgetMonth(store);
  const accounts = useAccountSummaries({ store, activeMonthId, cycle, language });
  const headline = accountsHeadline(accounts.summaries, accounts.coverage, language);
  const actionToast = useActionToast();
  const checkinForm = useBalanceCheckinForm({
    summaries: accounts.summaries,
    today: todayDateOnly,
    language,
    onRecord: recordAccountBalance,
  });
  const accountEditor = useAccountEditor({
    summaries: accounts.summaries,
    onAdd: addBalanceAccount,
    onUpdate: updateBalanceAccount,
    onDelete: (summary) => {
      deleteBalanceAccount(summary.account.id);
      actionToast.show({
        message: formatMessage(
          "insights.accounts.deleted",
          { name: accountDisplayName(summary.account, language) },
          language,
        ),
      });
    },
  });

  function deleteBalanceWithUndo(accountId: string, entry: BalanceEntry) {
    deleteAccountBalance({ accountId, date: entry.date });
    actionToast.show({
      message: formatMessage(
        "insights.balance.deleted",
        { date: formatShortDate(entry.date, language) },
        language,
      ),
      actionLabel: t("common.undo", language),
      onAction: () => {
        recordAccountBalance({ accountId, ...entry });
        actionToast.dismiss();
      },
    });
  }

  return (
    <DashboardShell
      headlineLabel={headline.label}
      headlineTitle={headline.title}
      activeTab="accounts"
      language={language}
      panelChrome={chrome.panelChrome}
    >
      <div className="grid w-full min-w-0 gap-8 overflow-hidden pb-8 pt-1">
        <h1 className="sr-only">{t("common.accounts", language)}</h1>
        <AccountsSection
          language={language}
          monthId={activeMonthId}
          summaries={accounts.summaries}
          coverage={accounts.coverage}
          savingsTarget={accounts.savingsTarget}
          onAdd={accountEditor.openAdd}
          onRecord={checkinForm.openForm}
          onEdit={accountEditor.openEdit}
          onMove={moveBalanceAccount}
          onDeleteEntry={deleteBalanceWithUndo}
        />
      </div>

      {checkinForm.formOpen ? (
        <BalanceCheckinSheet
          language={language}
          accountOptions={accounts.summaries.map((summary) => ({
            value: summary.account.id,
            label: accountDisplayName(summary.account, language),
          }))}
          accountId={checkinForm.accountId}
          date={checkinForm.date}
          amountText={checkinForm.amountText}
          maxDate={todayDateOnly}
          replacesEntry={checkinForm.replacesEntry}
          onAccountChange={checkinForm.selectAccount}
          onDateChange={checkinForm.setDate}
          onAmountChange={checkinForm.setAmountText}
          onClose={checkinForm.closeForm}
          onSubmit={checkinForm.submit}
        />
      ) : null}

      {accountEditor.open ? (
        <AccountEditorSheet
          language={language}
          isNew={accountEditor.isNew}
          accountName={
            accountEditor.editing
              ? accountDisplayName(accountEditor.editing.account, language)
              : undefined
          }
          name={accountEditor.name}
          role={accountEditor.role}
          onNameChange={accountEditor.setName}
          onRoleChange={accountEditor.setRole}
          onClose={accountEditor.close}
          onSubmit={accountEditor.submit}
          onDelete={accountEditor.requestDelete}
        />
      ) : null}

      <DeleteAccountDialog
        summary={accountEditor.confirmingDelete ? accountEditor.editing : null}
        language={language}
        onCancel={accountEditor.cancelDelete}
        onConfirm={accountEditor.confirmDelete}
      />

      {actionToast.toast ? (
        <ActionToast
          key={actionToast.toast.id}
          message={actionToast.toast.message}
          actionLabel={actionToast.toast.actionLabel}
          onAction={actionToast.toast.onAction}
          onPause={actionToast.pause}
          onResume={actionToast.resume}
        />
      ) : null}
    </DashboardShell>
  );
}
