import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import {
  DOMParser as XmlDomParser,
  XMLSerializer as XmlSerializer,
} from "@xmldom/xmldom";

import {
  detectImportFormat,
  exportGraph,
  importGraph,
  listExportFormats,
  listImportFormats,
} from "../index";

globalThis.DOMParser = XmlDomParser as unknown as typeof DOMParser;
globalThis.XMLSerializer = XmlSerializer as unknown as typeof XMLSerializer;

describe("export format registry", () => {
  const nodes: Node[] = [
    {
      id: "p-1",
      type: "place",
      position: { x: 40, y: 60 },
      data: { label: "p0", tokens: 1 },
    },
    {
      id: "t-1",
      type: "transition",
      position: { x: 280, y: 60 },
      data: { label: "o1-", lb: 0, ub: 1, isEditing: false },
    },
  ];

  const edges: Edge[] = [
    {
      id: "e-1",
      source: "p-1",
      target: "t-1",
      sourceHandle: "r.source",
      targetHandle: "l.target",
      type: "edge",
    },
  ];

  it("lists export formats", () => {
    const formats = listExportFormats();
    expect(formats.map((format) => format.id)).toEqual(["pnml", "ppp"]);
  });

  it("lists import formats", () => {
    const formats = listImportFormats();
    expect(formats.map((format) => format.id)).toEqual(["pnml", "ppp"]);
  });

  it("detects content format", () => {
    expect(
      detectImportFormat('<?xml version="1.0"?><pnml xmlns="x"></pnml>'),
    ).toBe("pnml");
    expect(detectImportFormat("spec(;t1){\nplace (p0);\ntrans(t1);\ntoken();\n}\n")).toBe(
      "ppp",
    );
  });

  it("falls back to filename extension when content is ambiguous", () => {
    expect(detectImportFormat("graph export", "sample.spec")).toBe("ppp");
    expect(detectImportFormat("graph export", "sample.xml")).toBe("pnml");
    expect(detectImportFormat("graph export", "sample.unknown")).toBeNull();
  });

  it("dispatches export and import through registry", () => {
    const pnml = exportGraph("pnml", {
      roomId: "room-1",
      roomName: "Registry",
      nodes,
      edges,
    });

    expect(pnml).toContain("<pnml");

    const imported = importGraph(pnml, { formatId: "pnml" });
    expect(imported.nodes).toHaveLength(2);
    expect(imported.edges).toHaveLength(1);

    const ppp = exportGraph("ppp", {
      roomId: "room-1",
      roomName: "Registry",
      nodes,
      edges,
    });

    expect(ppp).toContain("spec(");

    const importedPpp = importGraph(ppp, { formatId: "ppp" });
    expect(importedPpp.nodes).toHaveLength(2);
    expect(importedPpp.edges).toHaveLength(1);

    const importedAuto = importGraph(ppp, { formatId: "auto", fileName: "graph.ppp" });
    expect(importedAuto.nodes).toHaveLength(2);
  });

  it("throws when auto import format cannot be detected", () => {
    expect(() =>
      importGraph("not pnml and not ppp", {
        formatId: "auto",
        fileName: "mystery.bin",
      }),
    ).toThrowError("import_format_not_detected");
  });
});
