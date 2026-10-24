import { describe, expect, it } from "vitest";
import {
  availableMenuWidth,
  menuVerticalPlacement,
} from "./use-menu-viewport-clamp";

describe("availableMenuWidth", () => {
  it("keeps a right-aligned panel inside the left edge of the screen", () => {
    // Disparador del tema en Ajustes a 360px: su borde derecho queda en 314px.
    expect(
      availableMenuWidth({
        anchorLeft: 129,
        anchorRight: 314,
        anchorWidth: 185,
        viewportWidth: 360,
        align: "right",
      }),
    ).toBe(298);
  });

  it("keeps a left-aligned panel inside the right edge of the screen", () => {
    expect(
      availableMenuWidth({
        anchorLeft: 40,
        anchorRight: 200,
        anchorWidth: 160,
        viewportWidth: 360,
        align: "left",
      }),
    ).toBe(304);
  });

  it("never makes the panel narrower than its trigger", () => {
    expect(
      availableMenuWidth({
        anchorLeft: 0,
        anchorRight: 20,
        anchorWidth: 20,
        viewportWidth: 360,
        align: "right",
      }),
    ).toBe(20);
  });
});

describe("menuVerticalPlacement", () => {
  it("opens downward when the whole panel fits below the trigger", () => {
    expect(
      menuVerticalPlacement({
        anchorTop: 440,
        anchorBottom: 476,
        viewportHeight: 839,
        panelHeight: 326,
      }),
    ).toEqual({ placement: "bottom", maxHeight: null });
  });

  it("opens upward when it does not fit below and there is more room above", () => {
    // Menu de tema en Ajustes a 360x760: debajo quedan ~180px, arriba ~500px.
    expect(
      menuVerticalPlacement({
        anchorTop: 520,
        anchorBottom: 556,
        viewportHeight: 760,
        panelHeight: 326,
      }),
    ).toEqual({ placement: "top", maxHeight: null });
  });

  it("limits the height to the larger side when it fits on neither", () => {
    expect(
      menuVerticalPlacement({
        anchorTop: 200,
        anchorBottom: 236,
        viewportHeight: 400,
        panelHeight: 326,
      }),
    ).toEqual({ placement: "top", maxHeight: 180 });

    expect(
      menuVerticalPlacement({
        anchorTop: 100,
        anchorBottom: 136,
        viewportHeight: 400,
        panelHeight: 326,
      }),
    ).toEqual({ placement: "bottom", maxHeight: 244 });
  });

  it("only counts the visible part of the sheet that holds the trigger", () => {
    // Hoja baja al fondo de la pantalla: arriba de su borde el panel se cortaría.
    expect(
      menuVerticalPlacement({
        anchorTop: 643,
        anchorBottom: 687,
        viewportHeight: 893,
        panelHeight: 430,
        boundsTop: 433,
      }),
    ).toEqual({ placement: "top", maxHeight: 190 });

    expect(
      menuVerticalPlacement({
        anchorTop: 643,
        anchorBottom: 687,
        viewportHeight: 893,
        panelHeight: 430,
        boundsTop: 433,
        boundsBottom: 893,
      }).maxHeight,
    ).toBeLessThanOrEqual(643 - 433);
  });

  it("does not shrink the panel to an unusable height", () => {
    expect(
      menuVerticalPlacement({
        anchorTop: 60,
        anchorBottom: 96,
        viewportHeight: 200,
        panelHeight: 326,
      }),
    ).toEqual({ placement: "bottom", maxHeight: null });
  });
});
