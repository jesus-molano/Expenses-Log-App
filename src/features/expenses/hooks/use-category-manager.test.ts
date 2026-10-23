import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ExpenseCategory } from "@/domain/types";
import { useCategoryManager } from "./use-category-manager";

const categories: ExpenseCategory[] = [
  { id: "viajes", userId: "demo", name: "Viajes", icon: "Tag", tone: "rose" },
  { id: "general", userId: "demo", name: "General", icon: "WalletCards", tone: "slate" },
];

function setup() {
  const onCreate = vi.fn(() => "new-id");
  const onUpdate = vi.fn();
  const onDelete = vi.fn();
  const hook = renderHook(() =>
    useCategoryManager({ categories, language: "es", onCreate, onUpdate, onDelete }),
  );
  return { ...hook, onCreate, onUpdate, onDelete };
}

describe("useCategoryManager", () => {
  it("shows the name error and only creates a valid, new name", () => {
    const { result, onCreate } = setup();

    act(() => result.current.startCreate());
    act(() => result.current.submit());
    expect(result.current.error).toBe("Escribe un nombre.");

    act(() => result.current.setDraft({ name: "viajes", tone: "blue" }));
    expect(result.current.error).toBeNull();
    act(() => result.current.submit());
    expect(result.current.error).toBe("Ya tienes una categoría con ese nombre.");
    expect(onCreate).not.toHaveBeenCalled();

    act(() => result.current.setDraft({ name: "  Regalos ", tone: "blue" }));
    act(() => result.current.submit());
    expect(onCreate).toHaveBeenCalledWith({ name: "Regalos", tone: "blue" });
    expect(result.current.mode).toEqual({ kind: "list" });
  });

  it("renames keeping its own name valid", () => {
    const { result, onUpdate } = setup();

    act(() => result.current.startEdit(categories[0]));
    expect(result.current.draft).toEqual({ name: "Viajes", tone: "rose" });
    act(() => result.current.setDraft({ name: "Viajes", tone: "green" }));
    act(() => result.current.submit());
    expect(onUpdate).toHaveBeenCalledWith("viajes", { name: "Viajes", tone: "green" });
  });

  it("moves to General by default when deleting, or to Casa when deleting General", () => {
    const { result, onDelete } = setup();

    act(() => result.current.startDelete(categories[0]));
    expect(result.current.replacementName).toBe("General");
    act(() => result.current.confirmDelete());
    expect(onDelete).toHaveBeenCalledWith("viajes", "General");

    act(() => result.current.startDelete(categories[1]));
    expect(result.current.replacementName).toBe("Casa");
    act(() => result.current.setReplacementName("Viajes"));
    act(() => result.current.confirmDelete());
    expect(onDelete).toHaveBeenLastCalledWith("general", "Viajes");
  });
});
