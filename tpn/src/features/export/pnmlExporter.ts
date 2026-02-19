import type { Edge, Node } from "@xyflow/react";

export type PnmlExportInput = {
  roomId: string;
  roomName?: string;
  nodes: Node[];
  edges: Edge[];
};

export function exportPnml(_input: PnmlExportInput): string {
  throw new Error("pnml_export_not_implemented");
}
