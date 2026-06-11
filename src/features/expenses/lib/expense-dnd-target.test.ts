import { describe, expect, it } from "vitest";
import { getDropTargetFromEvent } from "./expense-dnd-target";

function eventFromData({
  data,
  overRect = { top: 100, height: 50 },
  activeTop = 100,
  activeHeight = 20,
}: {
  data: Record<string, unknown>;
  overRect?: { top: number; height: number };
  activeTop?: number;
  activeHeight?: number;
}) {
  return {
    over: {
      data: { current: data },
      rect: overRect,
    },
    active: {
      rect: {
        current: {
          translated: { top: activeTop, height: activeHeight },
        },
      },
    },
  } as never;
}

describe("getDropTargetFromEvent", () => {
  it("returns empty day targets", () => {
    expect(
      getDropTargetFromEvent(eventFromData({ data: { date: "2026-06-20" } })),
    ).toEqual({
      date: "2026-06-20",
      rowId: undefined,
      position: "before",
    });
  });

  it("returns before or after based on active center", () => {
    expect(
      getDropTargetFromEvent(
        eventFromData({
          data: { date: "2026-06-15", rowId: "icloud" },
          activeTop: 90,
        }),
      )?.position,
    ).toBe("before");

    expect(
      getDropTargetFromEvent(
        eventFromData({
          data: { date: "2026-06-15", rowId: "icloud" },
          activeTop: 140,
        }),
      )?.position,
    ).toBe("after");
  });
});
