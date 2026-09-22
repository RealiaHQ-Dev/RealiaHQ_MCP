import { describe, expect, it } from "vitest";
import { ConfigError, DEFAULT_API_URL, loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("defaults to the public site and no token", () => {
    expect(loadConfig({})).toEqual({ apiUrl: DEFAULT_API_URL, apiToken: null });
  });

  it("trims a trailing slash so paths never double up", () => {
    expect(loadConfig({ REALIA_API_URL: "http://localhost:3000/" }).apiUrl).toBe(
      "http://localhost:3000",
    );
  });

  it("rejects a url it could not call", () => {
    expect(() => loadConfig({ REALIA_API_URL: "not a url" })).toThrow(ConfigError);
  });

  it("treats a blank token as absent", () => {
    expect(loadConfig({ REALIA_API_TOKEN: "   " }).apiToken).toBeNull();
  });
});
