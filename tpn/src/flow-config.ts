import { StraightEdge } from "@xyflow/react";
import { PlaceNode, TransitionNode } from "./components/nodes";

export const nodeTypes = {
  place: PlaceNode,
  transition: TransitionNode,
};

export const edgeTypes = {
  edge: StraightEdge,
};
