import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("readEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns trimmed value from process.env", async () => {
    vi.stubEnv("TEST_VAR", "  hello  ");
    const { readEnv } = await import("./firebaseAdmin.js");
    expect(readEnv("TEST_VAR")).toBe("hello");
  });

  it("returns empty string when env var is not set", async () => {
    const { readEnv } = await import("./firebaseAdmin.js");
    expect(readEnv("__UNSET_VAR__")).toBe("");
  });
});

describe("isFirebaseConfigured", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true when all three Firebase env vars are set", async () => {
    vi.stubEnv("FIREBASE_PROJECT_ID", "my-project");
    vi.stubEnv("FIREBASE_CLIENT_EMAIL", "admin@my-project.iam.gserviceaccount.com");
    vi.stubEnv("FIREBASE_PRIVATE_KEY", "-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----");
    const { isFirebaseConfigured } = await import("./firebaseAdmin.js");
    expect(isFirebaseConfigured()).toBe(true);
  });

  it("returns false when FIREBASE_PROJECT_ID is missing", async () => {
    vi.stubEnv("FIREBASE_PROJECT_ID", "");
    vi.stubEnv("FIREBASE_CLIENT_EMAIL", "admin@example.com");
    vi.stubEnv("FIREBASE_PRIVATE_KEY", "key");
    const { isFirebaseConfigured } = await import("./firebaseAdmin.js");
    expect(isFirebaseConfigured()).toBe(false);
  });

  it("returns false when FIREBASE_CLIENT_EMAIL is missing", async () => {
    vi.stubEnv("FIREBASE_PROJECT_ID", "project");
    vi.stubEnv("FIREBASE_CLIENT_EMAIL", "");
    vi.stubEnv("FIREBASE_PRIVATE_KEY", "key");
    const { isFirebaseConfigured } = await import("./firebaseAdmin.js");
    expect(isFirebaseConfigured()).toBe(false);
  });

  it("returns false when FIREBASE_PRIVATE_KEY is missing", async () => {
    vi.stubEnv("FIREBASE_PROJECT_ID", "project");
    vi.stubEnv("FIREBASE_CLIENT_EMAIL", "admin@example.com");
    vi.stubEnv("FIREBASE_PRIVATE_KEY", "");
    const { isFirebaseConfigured } = await import("./firebaseAdmin.js");
    expect(isFirebaseConfigured()).toBe(false);
  });

  it("converts \\n escape sequences to real newlines in private key", async () => {
    vi.stubEnv("FIREBASE_PROJECT_ID", "project");
    vi.stubEnv("FIREBASE_CLIENT_EMAIL", "admin@example.com");
    vi.stubEnv("FIREBASE_PRIVATE_KEY", "line1\\nline2");
    const { isFirebaseConfigured } = await import("./firebaseAdmin.js");
    expect(isFirebaseConfigured()).toBe(true);
  });
});
