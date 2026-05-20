import type { FormatId } from "./types";

function stripLeadingPppComments(content: string) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

export function detectFormatFromContent(content: string): FormatId | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  if (/<\s*pnml\b/i.test(trimmed)) {
    return "pnml";
  }

  const pppCandidate = stripLeadingPppComments(trimmed).trim();
  if (/^(?:spec\s*\(|module\s+[^\s(]+\s*\()/i.test(pppCandidate)) {
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
