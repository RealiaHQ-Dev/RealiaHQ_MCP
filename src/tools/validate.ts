import { Buffer } from "node:buffer";

/** Realia rejects uploads above this. Checked here so a too-large file fails before the request. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const DATASET_EXTENSION = /\.(csv|tsv|txt|json)$/i;
const SOL_AMOUNT = /^(?:0|[1-9]\d*)(?:\.\d{1,9})?$/;
const TICKER = /^[A-Za-z0-9]+$/;

export function datasetFileNameError(name: string): string | null {
  if (name.includes("/") || name.includes("\\") || name.includes("\0")) {
    return "File name cannot include a path.";
  }
  if (!DATASET_EXTENSION.test(name)) {
    return "File name must end in .csv, .tsv, .txt, or .json.";
  }
  return null;
}

/** Used when the caller omits mime_type, so a .json file is not stored as text/csv. */
export function mimeTypeForFileName(name: string): string {
  switch (name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]) {
    case "json":
      return "application/json";
    case "tsv":
      return "text/tab-separated-values";
    case "txt":
      return "text/plain";
    default:
      return "text/csv";
  }
}

export function uploadContentError(content: string): string | null {
  if (content.trim().length === 0) return "File content is empty.";
  if (Buffer.byteLength(content, "utf8") > MAX_UPLOAD_BYTES) {
    return "File is over the 8 MB limit.";
  }
  return null;
}

export function solAmountError(value: string): string | null {
  if (!SOL_AMOUNT.test(value) || !(Number(value) > 0)) {
    return 'initial_buy_sol must be a positive SOL amount like "0.1".';
  }
  return null;
}

export function tickerError(symbol: string): string | null {
  if (!TICKER.test(symbol)) return "Ticker must use only letters and digits.";
  return null;
}
