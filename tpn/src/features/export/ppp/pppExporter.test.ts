import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";

import { exportPpp } from "./exporter";
import { importPpp } from "./importer";

describe("PPP exporter", () => {
  it("exports ppp text with expected section structure", () => {
    const nodes: Node[] = [
      {
        id: "p-0",
        type: "place",
        position: { x: 0, y: 0 },
        data: { label: "p0", tokens: 1 },
      },
      {
        id: "p-1",
        type: "place",
        position: { x: 0, y: 0 },
        data: { label: "p1", tokens: 0 },
      },
      {
        id: "t-1",
        type: "transition",
        position: { x: 0, y: 0 },
        data: { label: "o1-", lb: 0, ub: null },
      },
      {
        id: "t-2",
        type: "transition",
        position: { x: 0, y: 0 },
        data: { label: "o1+", lb: 2, ub: null },
      },
      {
        id: "t-3",
        type: "transition",
        position: { x: 0, y: 0 },
        data: { label: "o2-", lb: null, ub: null },
      },
    ];

    const edges: Edge[] = [
      { id: "e1", source: "p-0", target: "t-1", type: "edge" },
      { id: "e2", source: "t-1", target: "p-0", type: "edge" },
      { id: "e3", source: "p-1", target: "t-2", type: "edge" },
      { id: "e4", source: "t-2", target: "p-0", type: "edge" },
    ];

    const result = exportPpp({
      roomId: "room-1",
      roomName: "PPP",
      nodes,
      edges,
    });

    expect(result).toContain("spec(;o1-,o1+,o2-){");
    expect(result).toContain("place (p0,p1);");
    expect(result).toContain("trans(o1-,o1+,o2-);");
    expect(result).toContain("token(p0);");

    expect(result).toContain("o1- (p0)/(p0);");
    expect(result).toContain("o1+ [2,9999] (p1)/(p0);");
    expect(result).toContain("o2- [9999,9999] ()/();");

    expect(result).toContain("o1-=(o1-);");
    expect(result).toContain("o1+=(o1+);");
    expect(result).toContain("o2-=(o2-);");
  });

  it("rejects invalid transition interval", () => {
    const nodes: Node[] = [
      {
        id: "p-0",
        type: "place",
        position: { x: 0, y: 0 },
        data: { label: "p0", tokens: 0 },
      },
      {
        id: "t-1",
        type: "transition",
        position: { x: 0, y: 0 },
        data: { label: "o1-", lb: null, ub: 3 },
      },
    ];

    const edges: Edge[] = [
      { id: "e1", source: "p-0", target: "t-1", type: "edge" },
    ];

    expect(() =>
      exportPpp({ roomId: "room-1", roomName: "PPP", nodes, edges }),
    ).toThrowError("ppp_export_invalid_transition_interval");
  });

  it("rejects multi-token places", () => {
    const nodes: Node[] = [
      {
        id: "p-0",
        type: "place",
        position: { x: 0, y: 0 },
        data: { label: "p0", tokens: 3 },
      },
      {
        id: "t-1",
        type: "transition",
        position: { x: 0, y: 0 },
        data: { label: "t0", lb: 0, ub: null },
      },
    ];
    const edges: Edge[] = [{ id: "e1", source: "p-0", target: "t-1", type: "edge" }];
    expect(() => exportPpp({ roomId: "r", nodes, edges })).toThrowError(
      "ppp_export_unsupported_multi_token",
    );
  });

  it("rejects names containing PPP-reserved characters", () => {
    const nodes: Node[] = [
      {
        id: "p-0",
        type: "place",
        position: { x: 0, y: 0 },
        data: { label: "place one", tokens: 0 },
      },
      {
        id: "t-1",
        type: "transition",
        position: { x: 0, y: 0 },
        data: { label: "t0", lb: 0, ub: null },
      },
    ];
    const edges: Edge[] = [{ id: "e1", source: "p-0", target: "t-1", type: "edge" }];
    expect(() => exportPpp({ roomId: "r", nodes, edges })).toThrowError(
      "ppp_export_invalid_place_name",
    );
  });

  it("emits one module block per pppModule slug with input/output signature", () => {
    const nodes: Node[] = [
      {
        id: "p-g1-0",
        type: "place",
        position: { x: 0, y: 0 },
        data: { label: "p0", tokens: 0, pppModule: "g1" },
      },
      {
        id: "p-g1-1",
        type: "place",
        position: { x: 0, y: 0 },
        data: { label: "p1", tokens: 1, pppModule: "g1" },
      },
      {
        id: "t-g1-in",
        type: "transition",
        position: { x: 0, y: 0 },
        data: {
          label: "o3+",
          lb: 0,
          ub: null,
          pppModule: "g1",
          pppModuleKind: "module",
          pppModuleRole: "input",
        },
      },
      {
        id: "t-g1-out",
        type: "transition",
        position: { x: 0, y: 0 },
        data: {
          label: "o1+",
          lb: 4,
          ub: 5,
          pppModule: "g1",
          pppModuleKind: "module",
          pppModuleRole: "output",
        },
      },
      {
        id: "t-g1-int",
        type: "transition",
        position: { x: 0, y: 0 },
        data: {
          label: "t2@g1",
          lb: 0,
          ub: 0,
          pppModule: "g1",
          pppModuleKind: "module",
          pppModuleRole: "internal",
        },
      },
    ];

    const edges: Edge[] = [
      { id: "e1", source: "p-g1-0", target: "t-g1-in", type: "edge" },
      { id: "e2", source: "t-g1-in", target: "p-g1-1", type: "edge" },
      { id: "e3", source: "p-g1-1", target: "t-g1-out", type: "edge" },
      { id: "e4", source: "t-g1-out", target: "p-g1-0", type: "edge" },
      { id: "e5", source: "p-g1-0", target: "t-g1-int", type: "edge" },
      { id: "e6", source: "t-g1-int", target: "p-g1-1", type: "edge" },
    ];

    const result = exportPpp({ roomId: "r", nodes, edges });
    expect(result).toMatch(/module g1\(o3\+;o1\+\)\{/);
    expect(result).toContain("place (p0,p1);");
    expect(result).toContain("trans(o1+,o3+,t2@g1);");
    expect(result).toContain("token(p1);");
    expect(result).toContain("o3+ (p0)/(p1);");
    expect(result).toContain("o1+ [4,5] (p1)/(p0);");
    expect(result).toContain("t2@g1 [0,0] (p0)/(p1);");
  });

  it("rejects edges that cross module boundaries", () => {
    const nodes: Node[] = [
      {
        id: "p-a",
        type: "place",
        position: { x: 0, y: 0 },
        data: { label: "p0", tokens: 0, pppModule: "g1" },
      },
      {
        id: "t-b",
        type: "transition",
        position: { x: 0, y: 0 },
        data: { label: "t0", lb: 0, ub: null, pppModule: "g2" },
      },
    ];
    const edges: Edge[] = [{ id: "e1", source: "p-a", target: "t-b", type: "edge" }];
    expect(() => exportPpp({ roomId: "r", nodes, edges })).toThrowError(
      "ppp_export_cross_module_arc",
    );
  });

  it("round-trips multi-module + spec file", () => {
    const original = `module g1(o3+,o3-;o1+,o1-){
place (p0,p1);
trans (o3+,o3-,o1+,o1-);
token (p1);
o3+ (p0)/(p1);
o3- (p1)/(p0);
o1+ (p0)/(p1);
o1- (p1)/(p0);
o3+ = (o3+);
o3- = (o3-);
o1+ = (o1+);
o1- = (o1-);
}

spec(;o1-,o1+,o3-,o3+){
place (p0,p1);
trans(o1+,o1-,o3+,o3-);
token (p0);
o1- (p0)/(p1);
o1+ (p1)/(p0);
o3- (p0)/(p1);
o3+ (p1)/(p0);
o1- = (o1-);
o1+ = (o1+);
o3- = (o3-);
o3+ = (o3+);
}`;

    const firstImport = importPpp(original);
    const re = exportPpp({
      roomId: "r",
      nodes: firstImport.nodes,
      edges: firstImport.edges,
    });
    const secondImport = importPpp(re);

    const summarize = (nodes: typeof firstImport.nodes) => {
      const places = nodes
        .filter((n) => n.type === "place")
        .map((n) => {
          const data = n.data as { label?: string; tokens?: number; pppModule?: string };
          return `${data.pppModule}:${data.label}:${data.tokens ?? 0}`;
        })
        .sort();
      const transitions = nodes
        .filter((n) => n.type === "transition")
        .map((n) => {
          const data = n.data as {
            label?: string;
            lb?: number | null;
            ub?: number | null;
            pppModule?: string;
            pppModuleRole?: string;
          };
          return `${data.pppModule}:${data.label}:${data.lb}:${data.ub}:${data.pppModuleRole}`;
        })
        .sort();
      return { places, transitions };
    };

    expect(summarize(secondImport.nodes)).toEqual(summarize(firstImport.nodes));
    expect(secondImport.edges.length).toBe(firstImport.edges.length);
  });
});
