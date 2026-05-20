import { describe, it, expect } from "vitest";

import { normalizeFileBaseName, buildDownloadFileName } from "./download";

describe("normalizeFileBaseName", () => {
  it("lowercases and trims the input", () => {
    expect(normalizeFileBaseName("  Hello World  ")).toBe("hello-world");
  });

  it("replaces special characters with dashes", () => {
    expect(normalizeFileBaseName("model/export (v2)")).toBe("model-export-v2");
  });

  it("collapses consecutive dashes into one", () => {
    expect(normalizeFileBaseName("a---b")).toBe("a-b");
  });

  it("strips leading and trailing dashes", () => {
    expect(normalizeFileBaseName("---abc---")).toBe("abc");
  });

  it("preserves underscores and alphanumerics", () => {
    expect(normalizeFileBaseName("my_model_01")).toBe("my_model_01");
  });

  it("handles unicode by replacing non-ascii chars with dashes", () => {
    expect(normalizeFileBaseName("สวัสดี")).toBe("");
  });
});

describe("buildDownloadFileName", () => {
  it("combines cleaned base name with extension", () => {
    expect(buildDownloadFileName("My Model", ".pnml")).toBe("my-model.pnml");
  });

  it("prepends dot to extension if missing", () => {
    expect(buildDownloadFileName("model", "ppp")).toBe("model.ppp");
  });

  it("falls back to tpn-room when base name is empty after normalization", () => {
    expect(buildDownloadFileName("", ".pnml")).toBe("tpn-room.pnml");
  });

  it("falls back to tpn-room when base name contains only special chars", () => {
    expect(buildDownloadFileName("???", ".pnml")).toBe("tpn-room.pnml");
  });
});
