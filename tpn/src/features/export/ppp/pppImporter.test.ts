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

    expect(o1Minus?.data.pppModule).toBe("spec");
    expect(o1Minus?.data.pppModuleKind).toBe("spec");
    expect(o1Minus?.data.pppModuleRole).toBe("output");
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

  it("strips line and block comments before parsing", () => {
    const content = `// header comment describing the gate
/* block comment
spanning multiple lines */
spec(;t0){
place (p0,p1); // trailing comment
/* inline block */ trans(t0);
token();
t0 (p0)/(p1);
t0=(t0);
}`;

    const graph = importPpp(content);
    expect(graph.nodes.filter((n) => n.type === "place")).toHaveLength(2);
    expect(graph.nodes.filter((n) => n.type === "transition")).toHaveLength(1);
  });

  it("imports a single module-only file with special-char names", () => {
    const content = `// g13 OR GATE
module g13(w9-, w9+, w10-, w10+; existallzero+, existallzero-){
  place (p0, p1, p2, p3, p4, p5, p6, p7);
  trans (existallzero+, existallzero-, t2@g13, t3@g13, t4@g13, w9-, w9+, w10-, w10+);
  token (p1, p3, p5, p7);
  existallzero+ [4,5] (p0, p7)/(p0, p6);
  existallzero- [4,5] (p1, p6)/(p1, p7);
  t2@g13 [0,0] (p1, p2)/(p0, p2);
  t3@g13 [0,0] (p1, p4)/(p0, p4);
  t4@g13 [0,0] (p0, p3, p5)/(p1, p3, p5);
  w9- (p4)/(p5);
  w9+ (p5)/(p4);
  w10- (p2)/(p3);
  w10+ (p3)/(p2);
  existallzero+ = (existallzero+);
  existallzero- = (existallzero-);
  w9- = (w9-);
  w9+ = (w9+);
  w10- = (w10-);
  w10+ = (w10+);
}`;

    const graph = importPpp(content);

    const places = graph.nodes.filter((n) => n.type === "place");
    const transitions = graph.nodes.filter((n) => n.type === "transition");
    expect(places).toHaveLength(8);
    expect(transitions).toHaveLength(9);

    const labels = transitions.map((n) => n.data.label).sort();
    expect(labels).toContain("existallzero+");
    expect(labels).toContain("existallzero-");
    expect(labels).toContain("t2@g13");
    expect(labels).toContain("w9+");

    const existPlus = transitions.find((n) => n.data.label === "existallzero+");
    expect(existPlus?.data.pppModule).toBe("g13");
    expect(existPlus?.data.pppModuleKind).toBe("module");
    expect(existPlus?.data.pppModuleRole).toBe("output");

    const t2 = transitions.find((n) => n.data.label === "t2@g13");
    expect(t2?.data.pppModuleRole).toBe("internal");

    const w9minus = transitions.find((n) => n.data.label === "w9-");
    expect(w9minus?.data.pppModuleRole).toBe("input");
  });

  it("imports multi-module + spec file and stacks modules vertically", () => {
    const content = `module g1(o3+,o3-;o1+,o1-){
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

module g2(o1+,o1-;o2+,o2-){
place (p0,p1);
trans (o1+,o1-,o2+,o2-);
token (p1);
o1+ (p0)/(p1);
o1- (p1)/(p0);
o2+ (p0)/(p1);
o2- (p1)/(p0);
o1+ = (o1+);
o1- = (o1-);
o2+ = (o2+);
o2- = (o2-);
}

spec(;o1-,o1+,o2-,o2+,o3-,o3+){
place (p0,p1);
trans(o1+,o1-,o2+,o2-,o3+,o3-);
token (p0);
o1- (p0)/(p1);
o1+ (p1)/(p0);
o2- (p0)/(p1);
o2+ (p1)/(p0);
o3- (p0)/(p1);
o3+ (p1)/(p0);
o1- = (o1-);
o1+ = (o1+);
o2- = (o2-);
o2+ = (o2+);
o3- = (o3-);
o3+ = (o3+);
}`;

    const graph = importPpp(content);

    const moduleSlugs = new Set(
      graph.nodes.map((n) => (n.data as { pppModule?: string }).pppModule),
    );
    expect(moduleSlugs).toEqual(new Set(["g1", "g2", "spec"]));

    const g1Nodes = graph.nodes.filter(
      (n) => (n.data as { pppModule?: string }).pppModule === "g1",
    );
    const g2Nodes = graph.nodes.filter(
      (n) => (n.data as { pppModule?: string }).pppModule === "g2",
    );
    const specNodes = graph.nodes.filter(
      (n) => (n.data as { pppModule?: string }).pppModule === "spec",
    );

    expect(g1Nodes.length).toBeGreaterThan(0);
    expect(g2Nodes.length).toBeGreaterThan(0);
    expect(specNodes.length).toBeGreaterThan(0);

    const g1MaxY = Math.max(...g1Nodes.map((n) => n.position.y));
    const g2MinY = Math.min(...g2Nodes.map((n) => n.position.y));
    const specMinY = Math.min(...specNodes.map((n) => n.position.y));
    expect(g2MinY).toBeGreaterThan(g1MaxY);
    expect(specMinY).toBeGreaterThan(g2MinY);

    const o1PlusNodes = graph.nodes.filter(
      (n) => n.type === "transition" && n.data.label === "o1+",
    );
    expect(o1PlusNodes).toHaveLength(3);

    const g1o1Plus = o1PlusNodes.find(
      (n) => (n.data as { pppModule?: string }).pppModule === "g1",
    );
    const g2o1Plus = o1PlusNodes.find(
      (n) => (n.data as { pppModule?: string }).pppModule === "g2",
    );
    expect(g1o1Plus?.data.pppModuleRole).toBe("output");
    expect(g2o1Plus?.data.pppModuleRole).toBe("input");
  });

  it("rejects duplicate spec blocks", () => {
    const content = `spec(;a){place(p0);trans(a);token();a(p0)/(p0);a=(a);}
spec(;a){place(p0);trans(a);token();a(p0)/(p0);a=(a);}`;
    expect(() => importPpp(content)).toThrowError("ppp_import_duplicate_spec_block");
  });

  it("rejects duplicate module slugs", () => {
    const content = `module g1(;a){place(p0);trans(a);token();a(p0)/(p0);a=(a);}
module g1(;b){place(p0);trans(b);token();b(p0)/(p0);b=(b);}`;
    expect(() => importPpp(content)).toThrowError("ppp_import_duplicate_module");
  });
});
