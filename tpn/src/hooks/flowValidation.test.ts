import { describe, it, expect } from "vitest";

import { normalizeTransitionBound, isValidConnection } from "./flowValidation";

describe("normalizeTransitionBound", () => {
  it("returns null when value is null", () => {
    expect(normalizeTransitionBound(null, 0)).toBeNull();
  });

  it("returns fallback for NaN", () => {
    expect(normalizeTransitionBound(NaN, 5)).toBe(5);
  });

  it("returns fallback for non-number", () => {
    expect(normalizeTransitionBound("5", 3)).toBe(3);
    expect(normalizeTransitionBound(undefined, 3)).toBe(3);
  });

  it("returns fallback for Infinity", () => {
    expect(normalizeTransitionBound(Infinity, 0)).toBe(0);
  });

  it("clamps negative values to 0", () => {
    expect(normalizeTransitionBound(-5, 0)).toBe(0);
  });

  it("floors float values", () => {
    expect(normalizeTransitionBound(3.9, 0)).toBe(3);
    expect(normalizeTransitionBound(0.1, 0)).toBe(0);
  });

  it("returns the integer value for valid finite positive numbers", () => {
    expect(normalizeTransitionBound(10, 0)).toBe(10);
  });
});

describe("isValidConnection", () => {
  const nodes = [
    { id: "p1", type: "place" },
    { id: "p2", type: "place" },
    { id: "t1", type: "transition" },
    { id: "t2", type: "transition" },
  ];

  it("allows place → transition connections", () => {
    expect(isValidConnection({ source: "p1", target: "t1" }, nodes)).toBe(true);
  });

  it("allows transition → place connections", () => {
    expect(isValidConnection({ source: "t1", target: "p1" }, nodes)).toBe(true);
  });

  it("rejects place → place connections", () => {
    expect(isValidConnection({ source: "p1", target: "p2" }, nodes)).toBe(false);
  });

  it("rejects transition → transition connections", () => {
    expect(isValidConnection({ source: "t1", target: "t2" }, nodes)).toBe(false);
  });

  it("rejects self-connections", () => {
    expect(isValidConnection({ source: "p1", target: "p1" }, nodes)).toBe(false);
  });

  it("returns false when source node does not exist", () => {
    expect(isValidConnection({ source: "missing", target: "t1" }, nodes)).toBe(false);
  });

  it("returns false when target node does not exist", () => {
    expect(isValidConnection({ source: "p1", target: "missing" }, nodes)).toBe(false);
  });

  it("returns false when source is null", () => {
    expect(isValidConnection({ source: null, target: "t1" }, nodes)).toBe(false);
  });
});
