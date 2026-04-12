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
