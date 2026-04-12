import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import {
  DOMParser as XmlDomParser,
  XMLSerializer as XmlSerializer,
} from "@xmldom/xmldom";

import { exportPnml } from "./pnmlExporter";
import { importPnml } from "./pnmlImporter";

globalThis.DOMParser = XmlDomParser as unknown as typeof DOMParser;
globalThis.XMLSerializer = XmlSerializer as unknown as typeof XMLSerializer;

describe("PNML export/import", () => {
  it("preserves arc handles and transition interval on roundtrip", () => {
    const nodes: Node[] = [
      {
        id: "p-1",
        type: "place",
        position: { x: 80, y: 100 },
        data: { label: "P1", tokens: 1 },
      },
      {
        id: "t-1",
        type: "transition",
        position: { x: 280, y: 100 },
        data: { label: "T1", lb: 2, ub: 5, isEditing: false },
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
        data: { weight: 3 },
      },
    ];

    const pnml = exportPnml({
      roomId: "room-1",
      roomName: "Day5 Demo",
      nodes,
      edges,
    });

    expect(pnml).toContain("<sourceHandle>");
    expect(pnml).toContain("r.source");
    expect(pnml).toContain("<targetHandle>");
    expect(pnml).toContain("l.target");

    const imported = importPnml(pnml);

    expect(imported.nodes).toHaveLength(2);
    expect(imported.edges).toHaveLength(1);

    const importedTransition = imported.nodes.find((node) => node.id === "t-1");
    expect(importedTransition?.data.lb).toBe(2);
    expect(importedTransition?.data.ub).toBe(5);

    const importedEdge = imported.edges[0];
    expect(importedEdge.sourceHandle).toBe("r.source");
    expect(importedEdge.targetHandle).toBe("l.target");
    expect(importedEdge.data?.weight).toBe(3);
  });

  it("supports infinity upper bound on roundtrip", () => {
    const nodes: Node[] = [
      {
        id: "p-1",
        type: "place",
        position: { x: 80, y: 100 },
        data: { label: "P1", tokens: 0 },
      },
      {
        id: "t-1",
        type: "transition",
        position: { x: 280, y: 100 },
        data: { label: "T1", lb: 2, ub: null, isEditing: false },
      },
    ];

    const edges: Edge[] = [
      {
        id: "e-1",
        source: "p-1",
        target: "t-1",
        type: "edge",
      },
    ];

    const pnml = exportPnml({
      roomId: "room-1",
      roomName: "Infinity UB",
      nodes,
      edges,
    });

    expect(pnml).toMatch(/<ub>\s*inf\s*<\/ub>/);

    const imported = importPnml(pnml);
    const importedTransition = imported.nodes.find((node) => node.id === "t-1");

    expect(importedTransition?.data.lb).toBe(2);
    expect(importedTransition?.data.ub).toBeNull();
  });

  it("infers handles for arcs without toolspecific handle hints", () => {
    const rawPnml = `<?xml version="1.0" encoding="UTF-8"?>
<pnml xmlns="http://www.pnml.org/version-2009/grammar/pnml">
  <net id="n1" type="http://www.pnml.org/version-2009/grammar/ptnet">
    <page id="p1">
      <place id="p1">
        <graphics><position x="50" y="50"/></graphics>
      </place>
      <transition id="t1">
        <graphics><position x="50" y="200"/></graphics>
      </transition>
      <arc id="a1" source="p1" target="t1">
        <inscription><text>1</text></inscription>
      </arc>
    </page>
  </net>
</pnml>`;

    const imported = importPnml(rawPnml);
    const edge = imported.edges[0];

    expect(edge.sourceHandle).toBe("b.source");
    expect(edge.targetHandle).toBe("l.target");
  });

  it("rejects PNML import with non-binary place marking", () => {
    const rawPnml = `<?xml version="1.0" encoding="UTF-8"?>
<pnml xmlns="http://www.pnml.org/version-2009/grammar/pnml">
  <net id="n1" type="http://www.pnml.org/version-2009/grammar/ptnet">
    <page id="p1">
      <place id="p1">
        <name><text>P1</text></name>
        <initialMarking><text>2</text></initialMarking>
      </place>
      <transition id="t1" />
      <arc id="a1" source="p1" target="t1" />
    </page>
  </net>
</pnml>`;

    expect(() => importPnml(rawPnml)).toThrowError(
      "pnml_import_invalid_initial_marking",
    );
  });

  it("rejects PNML export with non-binary place marking", () => {
    const nodes: Node[] = [
      {
        id: "p-1",
        type: "place",
        position: { x: 80, y: 100 },
        data: { label: "P1", tokens: 2 },
      },
      {
        id: "t-1",
        type: "transition",
        position: { x: 280, y: 100 },
        data: { label: "T1", lb: 0, ub: 0, isEditing: false },
      },
    ];

    const edges: Edge[] = [
      {
        id: "e-1",
        source: "p-1",
        target: "t-1",
        type: "edge",
      },
    ];

    expect(() =>
      exportPnml({
        roomId: "room-1",
        roomName: "Binary Validation",
        nodes,
        edges,
      }),
    ).toThrowError("pnml_export_invalid_initial_marking");
  });

  it("rejects PNML import with invalid transition interval", () => {
    const rawPnml = `<?xml version="1.0" encoding="UTF-8"?>
<pnml xmlns="http://www.pnml.org/version-2009/grammar/pnml">
  <net id="n1" type="http://www.pnml.org/version-2009/grammar/ptnet">
    <page id="p1">
      <place id="p1" />
      <transition id="t1">
        <toolspecific tool="tpn-collab" version="1.0">
          <timeInterval>
            <lb>inf</lb>
            <ub>3</ub>
          </timeInterval>
        </toolspecific>
      </transition>
      <arc id="a1" source="p1" target="t1" />
    </page>
  </net>
</pnml>`;

    expect(() => importPnml(rawPnml)).toThrowError(
      "pnml_import_invalid_transition_interval",
    );
  });

  it("rejects PNML export with invalid transition interval", () => {
    const nodes: Node[] = [
      {
        id: "p-1",
        type: "place",
        position: { x: 80, y: 100 },
        data: { label: "P1", tokens: 0 },
      },
      {
        id: "t-1",
        type: "transition",
        position: { x: 280, y: 100 },
        data: { label: "T1", lb: null, ub: 5, isEditing: false },
      },
    ];

    const edges: Edge[] = [
      {
        id: "e-1",
        source: "p-1",
        target: "t-1",
        type: "edge",
      },
    ];

    expect(() =>
      exportPnml({
        roomId: "room-1",
        roomName: "Invalid Transition Interval",
        nodes,
        edges,
      }),
    ).toThrowError("pnml_export_invalid_transition_interval");
  });
});
