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

  it("expands chained topology across multiple alternating columns", () => {
    const positions = computeClusteredBipartiteLayout(
      [
        { id: "p0", kind: "place" },
        { id: "t0", kind: "transition" },
        { id: "p1", kind: "place" },
        { id: "t1", kind: "transition" },
        { id: "p2", kind: "place" },
      ],
      [
        { sourceId: "p0", targetId: "t0" },
        { sourceId: "t0", targetId: "p1" },
        { sourceId: "p1", targetId: "t1" },
        { sourceId: "t1", targetId: "p2" },
      ],
    );

    const p0 = positions.get("p0");
    const t0 = positions.get("t0");
    const p1 = positions.get("p1");
    const t1 = positions.get("t1");
    const p2 = positions.get("p2");

    expect(p0).toBeDefined();
    expect(t0).toBeDefined();
    expect(p1).toBeDefined();
    expect(t1).toBeDefined();
    expect(p2).toBeDefined();

    if (!p0 || !t0 || !p1 || !t1 || !p2) {
      throw new Error("layout_test_missing_position");
    }

    expect(p0.x).toBeLessThan(t0.x);
    expect(t0.x).toBeLessThan(p1.x);
    expect(p1.x).toBeLessThan(t1.x);
    expect(t1.x).toBeLessThan(p2.x);
  });

  it("uses orderHint as deterministic tie-break for same column nodes", () => {
    const positions = computeClusteredBipartiteLayout(
      [
        { id: "p0", kind: "place" },
        { id: "t0", kind: "transition" },
        { id: "p2", kind: "place" },
        { id: "p3", kind: "place" },
      ],
      [
        { sourceId: "p0", targetId: "t0" },
        { sourceId: "t0", targetId: "p2" },
        { sourceId: "t0", targetId: "p3" },
      ],
      {
        orderHint: new Map([
          ["p3", 0],
          ["p2", 1],
        ]),
      },
    );

    const p2 = positions.get("p2");
    const p3 = positions.get("p3");

    expect(p2).toBeDefined();
    expect(p3).toBeDefined();

    if (!p2 || !p3) {
      throw new Error("layout_test_missing_position");
    }

    expect(p3.x).toBe(p2.x);
    expect(p3.y).toBeLessThan(p2.y);
  });

  it("keeps branching transitions in separate rows inside the same stage", () => {
    const positions = computeClusteredBipartiteLayout(
      [
        { id: "p0", kind: "place" },
        { id: "t0", kind: "transition" },
        { id: "t1", kind: "transition" },
        { id: "p1", kind: "place" },
        { id: "p2", kind: "place" },
      ],
      [
        { sourceId: "p0", targetId: "t0" },
        { sourceId: "p0", targetId: "t1" },
        { sourceId: "t0", targetId: "p1" },
        { sourceId: "t1", targetId: "p2" },
      ],
    );

    const t0 = positions.get("t0");
    const t1 = positions.get("t1");
    const p0 = positions.get("p0");

    expect(t0).toBeDefined();
    expect(t1).toBeDefined();
    expect(p0).toBeDefined();

    if (!t0 || !t1 || !p0) {
      throw new Error("layout_test_missing_position");
    }

    expect(t0.x).toBe(t1.x);
    expect(t0.y).not.toBe(t1.y);
    expect(p0.x).toBeLessThan(t0.x);
  });

  it("produces non-overlapping positions for cyclic topology", () => {
    const positions = computeClusteredBipartiteLayout(
      [
        { id: "p0", kind: "place" },
        { id: "t0", kind: "transition" },
        { id: "p1", kind: "place" },
        { id: "t1", kind: "transition" },
      ],
      [
        { sourceId: "p0", targetId: "t0" },
        { sourceId: "t0", targetId: "p1" },
        { sourceId: "p1", targetId: "t1" },
        { sourceId: "t1", targetId: "p0" },
      ],
    );

    const uniquePositionCount = new Set(
      Array.from(positions.values()).map(({ x, y }) => `${x}:${y}`),
    ).size;

    expect(uniquePositionCount).toBe(4);
    expect(new Set(Array.from(positions.values()).map(({ x }) => x)).size).toBeGreaterThan(
      1,
    );
  });
});
