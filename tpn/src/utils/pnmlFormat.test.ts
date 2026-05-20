import { describe, it, expect } from "vitest";

import { formatPnmlXml } from "./pnmlFormat";

describe("formatPnmlXml", () => {
  it("throws on empty input", () => {
    expect(() => formatPnmlXml("")).toThrow("pnml_format_empty_input");
    expect(() => formatPnmlXml("   ")).toThrow("pnml_format_empty_input");
  });

  it("indents nested tags", () => {
    const result = formatPnmlXml("<root><child>text</child></root>");
    expect(result).toContain("  <child>");
    expect(result).toContain("  </child>");
  });

  it("preserves XML declaration on first line", () => {
    const input = '<?xml version="1.0"?><root></root>';
    const result = formatPnmlXml(input);
    expect(result.startsWith('<?xml version="1.0"?>')).toBe(true);
  });

  it("emits self-closing tags at their current depth without extra indent", () => {
    const result = formatPnmlXml("<root><empty/></root>");
    expect(result).toContain("  <empty/>");
  });

  it("handles three levels of nesting correctly", () => {
    const result = formatPnmlXml("<a><b><c>val</c></b></a>");
    expect(result).toContain("  <b>");
    expect(result).toContain("    <c>");
    expect(result).toContain("    </c>");
    expect(result).toContain("  </b>");
  });

  it("ends output with a newline", () => {
    const result = formatPnmlXml("<root/>");
    expect(result.endsWith("\n")).toBe(true);
  });
});
