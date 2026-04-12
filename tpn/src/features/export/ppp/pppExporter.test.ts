import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";

import { exportPpp } from "./exporter";

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
});
