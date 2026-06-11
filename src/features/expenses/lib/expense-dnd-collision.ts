import {
  closestCorners,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from "@dnd-kit/core";

const ROW_SNAP_DISTANCE = 88;

export const rowFirstCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const dayCollision = pointerCollisions.find((collision) => {
    const container = args.droppableContainers.find(
      (item) => item.id === collision.id,
    );
    return container?.data.current?.type === "day";
  });
  if (dayCollision) return [dayCollision];

  const rowContainers = args.droppableContainers.filter(
    (container) => container.data.current?.type === "row",
  );
  const activeCenterY = getActiveCenterY(args.active.rect.current.translated);

  if (rowContainers.length && activeCenterY !== null) {
    const nearestRow = closestCorners({
      ...args,
      droppableContainers: rowContainers,
    });
    const nearestId = nearestRow[0]?.id;
    const nearestRect =
      nearestId === undefined ? undefined : args.droppableRects.get(nearestId);

    if (nearestRect) {
      const nearestCenterY = nearestRect.top + nearestRect.height / 2;
      if (Math.abs(activeCenterY - nearestCenterY) <= ROW_SNAP_DISTANCE) {
        return nearestRow;
      }
    }
  }

  if (pointerCollisions.length) return pointerCollisions;

  return rectIntersection(args);
};

function getActiveCenterY(rect: { top: number; height: number } | null) {
  if (!rect) return null;
  return rect.top + rect.height / 2;
}
