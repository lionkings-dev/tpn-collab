import { describe, it, expect } from "vitest";

import { getBearerToken } from "./tokenUtils.js";

describe("getBearerToken", () => {
  it("returns the token from a valid Bearer header", () => {
    expect(getBearerToken("Bearer abc123")).toBe("abc123");
  });

  it("is case-insensitive on the scheme", () => {
    expect(getBearerToken("BEARER mytoken")).toBe("mytoken");
    expect(getBearerToken("bearer mytoken")).toBe("mytoken");
  });

  it("returns null when header is null", () => {
    expect(getBearerToken(null)).toBeNull();
  });

  it("returns null when header is undefined", () => {
    expect(getBearerToken(undefined)).toBeNull();
  });

  it("returns null when header is empty string", () => {
    expect(getBearerToken("")).toBeNull();
  });

  it("returns null when scheme is wrong", () => {
    expect(getBearerToken("Basic abc123")).toBeNull();
  });

  it("returns null when token part is missing", () => {
    expect(getBearerToken("Bearer")).toBeNull();
  });

  it("trims whitespace from token", () => {
    expect(getBearerToken("Bearer   ")).toBeNull();
  });
});
