import type { FormatId } from "./types";

export function detectFormatFromContent(content: string): FormatId | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  if (/<\s*pnml\b/i.test(trimmed)) {
    return "pnml";
  }

  if (/^\s*spec\s*\(/i.test(trimmed)) {
    return "ppp";
  }

  return null;
}

export function detectFormatFromFileName(fileName?: string): FormatId | null {
  if (!fileName) return null;

  const normalized = fileName.trim().toLowerCase();
  if (normalized.endsWith(".pnml") || normalized.endsWith(".xml")) {
    return "pnml";
  }
  if (normalized.endsWith(".ppp") || normalized.endsWith(".spec")) {
    return "ppp";
  }

  return null;
}
