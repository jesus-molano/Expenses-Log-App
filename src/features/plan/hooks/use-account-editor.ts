"use client";

import { type FormEvent, useState } from "react";
import type { BalanceAccountRole } from "@/domain/types";
import type { BalanceAccountInput } from "@/stores/app/account-commands";
import type { AccountSummary } from "../lib/account-summary";

type EditorState = {
  // null: cuenta nueva.
  accountId: string | null;
  name: string;
  role: BalanceAccountRole;
};

// Alta y edición de cuentas (nombre y papel) y su borrado con confirmación.
export function useAccountEditor({
  summaries,
  onAdd,
  onUpdate,
  onDelete,
}: {
  summaries: AccountSummary[];
  onAdd: (input: BalanceAccountInput) => void;
  onUpdate: (accountId: string, input: BalanceAccountInput) => void;
  // Recibe la cuenta tal como estaba, para avisar de que se ha borrado.
  onDelete: (summary: AccountSummary) => void;
}) {
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const editing = editor?.accountId
    ? (summaries.find((summary) => summary.account.id === editor.accountId) ?? null)
    : null;

  // La primera cuenta suele ser la de los recibos; después, una del día a día.
  function openAdd() {
    const hasBills = summaries.some((summary) => summary.account.role === "bills");
    setEditor({ accountId: null, name: "", role: hasBills ? "spending" : "bills" });
  }

  function openEdit(accountId: string) {
    const summary = summaries.find((item) => item.account.id === accountId);
    if (!summary) return;
    setEditor({ accountId, name: summary.account.name, role: summary.account.role });
  }

  function close() {
    setEditor(null);
    setConfirmingDelete(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    const input = { name: editor.name, role: editor.role };
    if (editor.accountId) onUpdate(editor.accountId, input);
    else onAdd(input);
    close();
  }

  function confirmDelete() {
    if (editing) onDelete(editing);
    close();
  }

  return {
    open: editor !== null,
    isNew: editor !== null && editor.accountId === null,
    // La cuenta que se edita (null al crear una).
    editing,
    name: editor?.name ?? "",
    role: editor?.role ?? "bills",
    setName: (name: string) => setEditor((current) => (current ? { ...current, name } : current)),
    setRole: (role: BalanceAccountRole) =>
      setEditor((current) => (current ? { ...current, role } : current)),
    openAdd,
    openEdit,
    close,
    submit,
    confirmingDelete: confirmingDelete && editing !== null,
    requestDelete: () => setConfirmingDelete(true),
    cancelDelete: () => setConfirmingDelete(false),
    confirmDelete,
  };
}
