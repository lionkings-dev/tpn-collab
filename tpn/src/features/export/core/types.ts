import type { Edge, Node } from "@xyflow/react";

export type FormatId = "pnml" | "ppp";

export type GraphExportInput = {
  roomId: string;
  roomName?: string;
  nodes: Node[];
  edges: Edge[];
};

export type GraphImportResult = {
  netId?: string;
  netName?: string;
  nodes: Node[];
  edges: Edge[];
};

export type GraphFormat = {
  id: FormatId;
  label: string;
  extensions: string[];
  mimeTypes: string[];
  canExport: boolean;
  canImport: boolean;
  exportGraph?: (input: GraphExportInput) => string;
  importGraph?: (content: string) => GraphImportResult;
};

export type ExportFormatOption = Pick<GraphFormat, "id" | "label">;
