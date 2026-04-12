function normalizeFileBaseName(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  return normalized.replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
}

export function buildDownloadFileName(baseName: string, extension: string) {
  const cleanedBase = normalizeFileBaseName(baseName);
  const normalizedExtension = extension.startsWith(".") ? extension : `.${extension}`;
  return `${cleanedBase || "tpn-room"}${normalizedExtension}`;
}

export function downloadTextFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}
