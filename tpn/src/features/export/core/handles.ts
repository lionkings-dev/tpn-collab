import type { Node } from "@xyflow/react";

type SupportedNodeType = "place" | "transition";

function toNodeType(value: Node["type"]): SupportedNodeType | null {
  if (value === "place" || value === "transition") {
    return value;
  }
  return null;
}

export function inferArcHandles(sourceNode: Node, targetNode: Node) {
  const sourceType = toNodeType(sourceNode.type);
  const targetType = toNodeType(targetNode.type);
  if (!sourceType || !targetType) {
    return {};
  }

  const dx = targetNode.position.x - sourceNode.position.x;
  const dy = targetNode.position.y - sourceNode.position.y;
  const horizontalDominant = Math.abs(dx) >= Math.abs(dy);

  let sourceHandle: string;
  let targetHandle: string;

  if (horizontalDominant) {
    sourceHandle = dx >= 0 ? "r.source" : "l.source";
    targetHandle = dx >= 0 ? "l.target" : "r.target";
  } else {
    sourceHandle = dy >= 0 ? "b.source" : "t.source";
    targetHandle = dy >= 0 ? "t.target" : "b.target";
  }

  if (sourceType === "transition") {
    sourceHandle = dx >= 0 ? "r.source" : "l.source";
  }

  if (targetType === "transition") {
    targetHandle = dx >= 0 ? "l.target" : "r.target";
  }

  return {
    sourceHandle,
    targetHandle,
  };
}

export function inferSharedPlaceTransitionHandles() {
  return {
    placeToTransition: {
      sourceHandle: "r.source",
      targetHandle: "l.target",
    },
    transitionToPlace: {
      sourceHandle: "l.source",
      targetHandle: "r.target",
    },
  };
}
