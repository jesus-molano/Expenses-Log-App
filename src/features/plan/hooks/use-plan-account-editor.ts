"use client";

import {
  PLAN_ACCOUNT_NAME_MAX_LENGTH,
  normalizeUniquePlanAccountPurposes,
  sortPlanAccountPurposes,
} from "@/domain/plan-accounts";
import type { PlanAccount, PlanAccountPurpose } from "@/domain/types";

export function togglePlanAccountPurpose(
  accounts: PlanAccount[],
  account: PlanAccount,
  purpose: PlanAccountPurpose,
): PlanAccount[] {
  const selected = account.purposes.includes(purpose);

  return accounts.map((item) => {
    if (item.id === account.id) {
      return {
        ...item,
        purposes: selected
          ? item.purposes.filter((current) => current !== purpose)
          : sortPlanAccountPurposes([...item.purposes, purpose]),
      };
    }

    return {
      ...item,
      purposes: item.purposes.filter((current) => current !== purpose),
    };
  });
}

export function removePlanAccount(
  accounts: PlanAccount[],
  accountId: string,
): PlanAccount[] {
  if (accounts.length <= 1) return accounts;

  const removed = accounts.find((account) => account.id === accountId);
  const remaining = accounts.filter((account) => account.id !== accountId);
  if (!removed || !remaining.length) return accounts;

  const reassignedPurposes = new Set(removed.purposes);
  const [destination, ...rest] = remaining;

  return normalizeUniquePlanAccountPurposes([
    {
      ...destination,
      purposes: sortPlanAccountPurposes([
        ...destination.purposes,
        ...removed.purposes,
      ]),
    },
    ...rest.map((account) => ({
      ...account,
      purposes: account.purposes.filter(
        (purpose) => !reassignedPurposes.has(purpose),
      ),
    })),
  ]);
}

export function usePlanAccountEditor({
  accounts,
  onAccountsChange,
}: {
  accounts: PlanAccount[];
  onAccountsChange: (value: PlanAccount[]) => void;
}) {
  function updateAccount(accountId: string, nextAccount: PlanAccount) {
    onAccountsChange(
      accounts.map((account) =>
        account.id === accountId ? nextAccount : account,
      ),
    );
  }

  function renameAccount(account: PlanAccount, name: string) {
    updateAccount(account.id, {
      ...account,
      name: name.slice(0, PLAN_ACCOUNT_NAME_MAX_LENGTH),
    });
  }

  function togglePurpose(account: PlanAccount, purpose: PlanAccountPurpose) {
    onAccountsChange(togglePlanAccountPurpose(accounts, account, purpose));
  }

  function addAccount() {
    if (accounts.length >= 3) return;
    onAccountsChange([
      ...accounts,
      {
        id: `acct-${crypto.randomUUID()}`,
        name: `Cuenta ${accounts.length + 1}`,
        purposes: [],
      },
    ]);
  }

  function removeAccount(accountId: string) {
    onAccountsChange(removePlanAccount(accounts, accountId));
  }

  return {
    canAddAccount: accounts.length < 3,
    canRemoveAccount: accounts.length > 1,
    renameAccount,
    togglePurpose,
    addAccount,
    removeAccount,
  };
}
