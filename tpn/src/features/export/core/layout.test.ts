import { describe, expect, it } from "vitest";

import { computeClusteredBipartiteLayout } from "./layout";

describe("computeClusteredBipartiteLayout", () => {
  it("assigns unique positions and separates node kinds into columns", () => {
    const positions = computeClusteredBipartiteLayout(
      [
        { id: "p0", kind: "place" },
        { id: "p1", kind: "place" },
        { id: "t0", kind: "transition" },
      ],
      [
        { sourceId: "p0", targetId: "t0" },
        { sourceId: "t0", targetId: "p1" },
      ],
    );

    expect(positions.size).toBe(3);

    const values = Array.from(positions.values()).map(({ x, y }) => `${x}:${y}`);
    expect(new Set(values).size).toBe(values.length);

    const p0 = positions.get("p0");
    const p1 = positions.get("p1");
    const t0 = positions.get("t0");

    expect(p0).toBeDefined();
    expect(p1).toBeDefined();
    expect(t0).toBeDefined();

    if (!p0 || !p1 || !t0) {
      throw new Error("layout_test_missing_position");
    }

    expect(t0.x).toBeGreaterThanOrEqual(p0.x);
    expect(p1.x).toBeGreaterThanOrEqual(t0.x);
  });

  it("separates disconnected components", () => {
    const positions = computeClusteredBipartiteLayout(
      [
        { id: "p0", kind: "place" },
        { id: "t0", kind: "transition" },
        { id: "p2", kind: "place" },
        { id: "t2", kind: "transition" },
      ],
      [
        { sourceId: "p0", targetId: "t0" },
        { sourceId: "p2", targetId: "t2" },
      ],
    );

    const p0 = positions.get("p0");
    const t0 = positions.get("t0");
    const p2 = positions.get("p2");
    const t2 = positions.get("t2");

    expect(p0).toBeDefined();
    expect(t0).toBeDefined();
    expect(p2).toBeDefined();
    expect(t2).toBeDefined();

    if (!p0 || !t0 || !p2 || !t2) {
      throw new Error("layout_test_missing_position");
    }

    const componentAmaxX = Math.max(p0.x, t0.x);
    const componentBminX = Math.min(p2.x, t2.x);
    expect(componentBminX).toBeGreaterThan(componentAmaxX);
  });
});
