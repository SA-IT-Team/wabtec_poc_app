import { afterEach, describe, expect, it, vi } from "vitest";
import { getEnvConnectionConfig } from "./env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getEnvConnectionConfig", () => {
  it("returns null when neither env var is set", () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.stubEnv("VITE_API_ACCESS_KEY", "");
    expect(getEnvConnectionConfig()).toBeNull();
  });

  it("returns null when only one of the two is set", () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://bdx-poc.vercel.app");
    vi.stubEnv("VITE_API_ACCESS_KEY", "");
    expect(getEnvConnectionConfig()).toBeNull();
  });

  it("returns the trimmed config when both are set", () => {
    vi.stubEnv("VITE_API_BASE_URL", "  https://bdx-poc.vercel.app  ");
    vi.stubEnv("VITE_API_ACCESS_KEY", "  test-secret  ");
    expect(getEnvConnectionConfig()).toEqual({ baseUrl: "https://bdx-poc.vercel.app", apiKey: "test-secret" });
  });

  it("supports a local backend URL", () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://127.0.0.1:8000");
    vi.stubEnv("VITE_API_ACCESS_KEY", "local-secret");
    expect(getEnvConnectionConfig()).toEqual({ baseUrl: "http://127.0.0.1:8000", apiKey: "local-secret" });
  });
});
