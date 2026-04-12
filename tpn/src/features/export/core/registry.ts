import { exportPnml, importPnml } from "../pnml";
import { exportPpp, importPpp } from "../ppp";
import { detectFormatFromContent, detectFormatFromFileName } from "./detectFormat";
import type {
  ExportFormatOption,
  FormatId,
  GraphExportInput,
  GraphFormat,
  GraphImportResult,
} from "./types";

const FORMATS: Record<FormatId, GraphFormat> = {
  pnml: {
    id: "pnml",
    label: "PNML",
    extensions: [".pnml", ".xml"],
    mimeTypes: ["application/xml;charset=utf-8", "text/xml;charset=utf-8"],
    canExport: true,
    canImport: true,
    exportGraph: exportPnml,
    importGraph: importPnml,
  },
  ppp: {
    id: "ppp",
    label: "PPP",
    extensions: [".ppp", ".spec", ".txt"],
    mimeTypes: ["text/plain;charset=utf-8"],
    canExport: true,
    canImport: true,
    exportGraph: exportPpp,
    importGraph: importPpp,
  },
};

export type ImportGraphOptions = {
  formatId?: FormatId | "auto";
  fileName?: string;
};

export function getFormatById(formatId: FormatId) {
  return FORMATS[formatId];
}

export function listFormats() {
  return Object.values(FORMATS);
}

export function listExportFormats(): ExportFormatOption[] {
  return listFormats()
    .filter((format) => format.canExport)
    .map((format) => ({ id: format.id, label: format.label }));
}

export function listImportFormats(): ExportFormatOption[] {
  return listFormats()
    .filter((format) => format.canImport)
    .map((format) => ({ id: format.id, label: format.label }));
}

export function detectImportFormat(content: string, fileName?: string): FormatId | null {
  return detectFormatFromContent(content) ?? detectFormatFromFileName(fileName);
}

export function exportGraph(formatId: FormatId, input: GraphExportInput): string {
  const format = getFormatById(formatId);
  if (!format.exportGraph) {
    throw new Error("export_format_not_supported");
  }

  return format.exportGraph(input);
}

export function importGraph(
  content: string,
  { formatId = "auto", fileName }: ImportGraphOptions = {},
): GraphImportResult {
  const resolvedFormatId =
    formatId === "auto" ? detectImportFormat(content, fileName) : formatId;

  if (!resolvedFormatId) {
    throw new Error("import_format_not_detected");
  }

  const format = getFormatById(resolvedFormatId);
  if (!format.importGraph) {
    throw new Error("import_format_not_supported");
  }

  return format.importGraph(content);
}
