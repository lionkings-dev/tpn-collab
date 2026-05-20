import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { exportPpp } from "./exporter";
import { importPpp } from "./importer";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(here, "__fixtures__");

function loadFixture(name: string) {
  return readFileSync(path.join(fixturesDir, name), "utf8");
}

describe("PPP fixtures (real-world files)", () => {
  it("imports and re-exports or.ppp (single-module OR gate with leading comment)", () => {
    const graph = importPpp(loadFixture("or.ppp"));
    expect(graph.nodes.filter((n) => n.type === "place")).toHaveLength(8);
    expect(graph.nodes.filter((n) => n.type === "transition")).toHaveLength(9);

    const transitionLabels = graph.nodes
      .filter((n) => n.type === "transition")
      .map((n) => n.data.label);
    expect(transitionLabels).toEqual(
      expect.arrayContaining([
        "existallzero+",
        "existallzero-",
        "t2@g13",
        "t3@g13",
        "t4@g13",
        "w9-",
        "w9+",
        "w10-",
        "w10+",
      ]),
    );

    const exported = exportPpp({ roomId: "r", nodes: graph.nodes, edges: graph.edges });
    expect(exported).toContain("module g13(");
    const reImport = importPpp(exported);
    expect(reImport.nodes.length).toBe(graph.nodes.length);
    expect(reImport.edges.length).toBe(graph.edges.length);
  });

  it("imports and re-exports and.ppp (module name with @ in slug)", () => {
    const graph = importPpp(loadFixture("and.ppp"));
    expect(graph.nodes.filter((n) => n.type === "place")).toHaveLength(8);
    expect(graph.nodes.filter((n) => n.type === "transition")).toHaveLength(9);

    const w7Plus = graph.nodes.find(
      (n) => n.type === "transition" && n.data.label === "w7@er+",
    );
    expect(w7Plus?.data.pppModule).toBe("g7@er");
    expect(w7Plus?.data.pppModuleRole).toBe("output");

    const exported = exportPpp({ roomId: "r", nodes: graph.nodes, edges: graph.edges });
    expect(exported).toContain("module g7@er(");
    const reImport = importPpp(exported);
    expect(reImport.nodes.length).toBe(graph.nodes.length);
    expect(reImport.edges.length).toBe(graph.edges.length);
  });

  it("imports xor.ppp (3 modules + spec) and stacks each as its own band", () => {
    const graph = importPpp(loadFixture("xor.ppp"));

    const modulesPresent = new Set(
      graph.nodes.map((n) => (n.data as { pppModule?: string }).pppModule),
    );
    expect(modulesPresent).toEqual(new Set(["g1", "g2", "g3", "spec"]));

    const yByModule = new Map<string, number[]>();
    for (const node of graph.nodes) {
      const slug = (node.data as { pppModule?: string }).pppModule ?? "";
      const ys = yByModule.get(slug) ?? [];
      ys.push(node.position.y);
      yByModule.set(slug, ys);
    }

    const moduleOrder = ["g1", "g2", "g3", "spec"];
    let prevMaxY = -Infinity;
    for (const slug of moduleOrder) {
      const ys = yByModule.get(slug);
      expect(ys?.length).toBeGreaterThan(0);
      const minY = Math.min(...(ys ?? [0]));
      const maxY = Math.max(...(ys ?? [0]));
      expect(minY).toBeGreaterThan(prevMaxY);
      prevMaxY = maxY;
    }

    const o1Plus = graph.nodes.filter(
      (n) => n.type === "transition" && n.data.label === "o1+",
    );
    expect(o1Plus.length).toBe(3);

    const exported = exportPpp({ roomId: "r", nodes: graph.nodes, edges: graph.edges });
    expect(exported).toContain("module g1(");
    expect(exported).toContain("module g2(");
    expect(exported).toContain("module g3(");
    expect(exported).toContain("spec(;");

    const reImport = importPpp(exported);
    expect(reImport.nodes.length).toBe(graph.nodes.length);
    expect(reImport.edges.length).toBe(graph.edges.length);
  });
});
