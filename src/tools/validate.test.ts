import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  datasetFileNameError,
  mimeTypeForFileName,
  solAmountError,
  tickerError,
  uploadContentError,
} from "./validate.js";

describe("dataset uploads", () => {
  it("accepts the documented extensions and rejects a path", () => {
    expect(datasetFileNameError("chips.csv")).toBeNull();
    expect(datasetFileNameError("CHIPS.JSON")).toBeNull();
    expect(datasetFileNameError("notes.pdf")).toMatch(/\.csv/);
    expect(datasetFileNameError("../chips.csv")).toMatch(/path/);
  });

  it("infers a mime type from the extension", () => {
    expect(mimeTypeForFileName("chips.json")).toBe("application/json");
    expect(mimeTypeForFileName("chips.tsv")).toBe("text/tab-separated-values");
    expect(mimeTypeForFileName("chips.txt")).toBe("text/plain");
    expect(mimeTypeForFileName("chips.csv")).toBe("text/csv");
  });

  it("rejects empty and oversized content", () => {
    expect(uploadContentError("   \n")).toMatch(/empty/);
    expect(uploadContentError("a,b")).toBeNull();
    expect(uploadContentError("x".repeat(MAX_UPLOAD_BYTES + 1))).toMatch(/8 MB/);
  });
});

describe("launch input", () => {
  it("requires a positive decimal SOL amount and a plain ticker", () => {
    expect(solAmountError("0.1")).toBeNull();
    expect(solAmountError("0")).toMatch(/SOL/);
    expect(solAmountError("lots")).toMatch(/SOL/);
    expect(tickerError("sun")).toBeNull();
    expect(tickerError("S N")).toMatch(/letters/);
  });
});
