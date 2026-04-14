import { describe, expect, it } from "vitest";

import { importPpp } from "./importer";

describe("PPP importer", () => {
  it("imports valid ppp content with intervals and tokens", () => {
    const content = `spec(;o1-,o1+,o2-,o2+,o3-,o3+){
place (p0,p1,p2,p3,p4,p5);
trans(o1+,o1-,o2+,o2-,o3+,o3-);
token(p0,p2,p4);
o1- [4,5] (p0)/(p1);
o1+ [0,9999] (p1)/(p0);
o2- (p2)/(p3);
o2+ (p3)/(p2);
o3- (p4)/(p5);
o3+ (p5)/(p4);
o1-=(o1-);
o1+=(o1+);
o2-=(o2-);
o2+=(o2+);
o3-=(o3-);
o3+=(o3+);
}`;

    const graph = importPpp(content);

    expect(graph.nodes).toHaveLength(12);
    expect(graph.edges).toHaveLength(12);

    const o1Minus = graph.nodes.find(
      (node) => node.type === "transition" && node.data.label === "o1-",
    );
    const o1Plus = graph.nodes.find(
      (node) => node.type === "transition" && node.data.label === "o1+",
    );
    const o2Minus = graph.nodes.find(
      (node) => node.type === "transition" && node.data.label === "o2-",
    );

    expect(o1Minus?.data.lb).toBe(4);
    expect(o1Minus?.data.ub).toBe(5);
    expect(o1Plus?.data.lb).toBe(0);
    expect(o1Plus?.data.ub).toBeNull();
    expect(o2Minus?.data.lb).toBe(0);
    expect(o2Minus?.data.ub).toBeNull();

    const tokenPlaces = graph.nodes
      .filter((node) => node.type === "place" && node.data.tokens === 1)
      .map((node) => node.data.label)
      .sort();
    expect(tokenPlaces).toEqual(["p0", "p2", "p4"]);

    expect(graph.edges.every((edge) => edge.sourceHandle && edge.targetHandle)).toBe(
      true,
    );

    const positionKeys = graph.nodes.map(
      (node) => `${node.position.x}:${node.position.y}`,
    );
    expect(new Set(positionKeys).size).toBe(positionKeys.length);
  });

  it("uses shared right/left handles for same place input/output", () => {
    const content = `spec(;o1-){
place (p0);
trans(o1-);
token();
o1- [0,1] (p0)/(p0);
o1-=(o1-);
}`;

    const graph = importPpp(content);

    const placeNode = graph.nodes.find(
      (node) => node.type === "place" && node.data.label === "p0",
    );
    const transitionNode = graph.nodes.find(
      (node) => node.type === "transition" && node.data.label === "o1-",
    );

    expect(placeNode).toBeDefined();
    expect(transitionNode).toBeDefined();

    const inputEdge = graph.edges.find(
      (edge) =>
        edge.source === placeNode?.id &&
        edge.target === transitionNode?.id &&
        edge.sourceHandle === "r.source" &&
        edge.targetHandle === "l.target",
    );
    const outputEdge = graph.edges.find(
      (edge) =>
        edge.source === transitionNode?.id &&
        edge.target === placeNode?.id &&
        edge.sourceHandle === "l.source" &&
        edge.targetHandle === "r.target",
    );

    expect(inputEdge).toBeDefined();
    expect(outputEdge).toBeDefined();
  });

  it("lays out chained PPP transitions across progressive columns", () => {
    const content = `spec(;t0,t1){
place (p0,p1,p2);
trans(t0,t1);
token();
t0 (p0)/(p1);
t1 (p1)/(p2);
t0=(t0);
t1=(t1);
}`;

    const graph = importPpp(content);

    const byLabel = new Map(
      graph.nodes
        .filter((node) => node.type === "place" || node.type === "transition")
        .map((node) => [String(node.data.label), node]),
    );

    const p0 = byLabel.get("p0");
    const t0 = byLabel.get("t0");
    const p1 = byLabel.get("p1");
    const t1 = byLabel.get("t1");
    const p2 = byLabel.get("p2");

    expect(p0).toBeDefined();
    expect(t0).toBeDefined();
    expect(p1).toBeDefined();
    expect(t1).toBeDefined();
    expect(p2).toBeDefined();

    if (!p0 || !t0 || !p1 || !t1 || !p2) {
      throw new Error("ppp_import_test_missing_position");
    }

    expect(p0.position.x).toBeLessThan(t0.position.x);
    expect(t0.position.x).toBeLessThan(p1.position.x);
    expect(p1.position.x).toBeLessThan(t1.position.x);
    expect(t1.position.x).toBeLessThan(p2.position.x);
  });

  it("separates disconnected PPP components horizontally", () => {
    const content = `spec(;a,b){
place (p0,p1,q0,q1);
trans(a,b);
token();
a (p0)/(p1);
b (q0)/(q1);
a=(a);
b=(b);
}`;

    const graph = importPpp(content);

    const byLabel = new Map(graph.nodes.map((node) => [String(node.data.label), node]));
    const p0 = byLabel.get("p0");
    const p1 = byLabel.get("p1");
    const q0 = byLabel.get("q0");
    const q1 = byLabel.get("q1");

    expect(p0).toBeDefined();
    expect(p1).toBeDefined();
    expect(q0).toBeDefined();
    expect(q1).toBeDefined();

    if (!p0 || !p1 || !q0 || !q1) {
      throw new Error("ppp_import_test_missing_position");
    }

    const componentAmaxX = Math.max(p0.position.x, p1.position.x);
    const componentBminX = Math.min(q0.position.x, q1.position.x);
    expect(componentBminX).toBeGreaterThan(componentAmaxX);
  });

  it("rejects token references to undefined place", () => {
    const content = `spec(;o1-){
place (p0,p1);
trans(o1-);
token(p2);
o1- (p0)/(p1);
o1-=(o1-);
}`;

    expect(() => importPpp(content)).toThrowError(
      "ppp_import_invalid_token_reference",
    );
  });

  it("rejects invalid transition interval", () => {
    const content = `spec(;o1-){
place (p0,p1);
trans(o1-);
token();
o1- [9999,3] (p0)/(p1);
o1-=(o1-);
}`;

    expect(() => importPpp(content)).toThrowError(
      "ppp_import_invalid_transition_interval",
    );
  });

  it("rejects unknown place in connection", () => {
    const content = `spec(;o1-){
place (p0,p1);
trans(o1-);
token();
o1- (p0)/(p2);
o1-=(o1-);
}`;

    expect(() => importPpp(content)).toThrowError(
      "ppp_import_connection_place_not_found",
    );
  });

  it("rejects unknown transition in definition line", () => {
    const content = `spec(;o1-){
place (p0,p1);
trans(o1-);
token();
o1- (p0)/(p1);
o2-=(o2-);
}`;

    expect(() => importPpp(content)).toThrowError(
      "ppp_import_definition_transition_not_found",
    );
  });
});
