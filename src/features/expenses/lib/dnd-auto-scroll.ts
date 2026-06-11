export type AutoScrollDirection = "up" | "down" | null;

export function getAutoScrollDirection({
  pointerY,
  viewportHeight,
  edgeSize = 96,
}: {
  pointerY: number;
  viewportHeight: number;
  edgeSize?: number;
}): AutoScrollDirection {
  if (pointerY < edgeSize) return "up";
  if (pointerY > viewportHeight - edgeSize) return "down";
  return null;
}

export function getAutoScrollDelta(direction: AutoScrollDirection) {
  if (direction === "up") return -14;
  if (direction === "down") return 14;
  return 0;
}
