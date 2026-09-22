import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Coin, RealiaClient } from "../realia/types.js";

export type ToolContext = {
  client: RealiaClient;
};

export const limitSchema = z.number().int().min(1).max(50).default(10);

export function textResult(
  text: string,
  structuredContent: Record<string, unknown>,
): CallToolResult {
  return { content: [{ type: "text", text }], structuredContent };
}

/**
 * A failed call is reported as a tool error, not a thrown one: the model can
 * then explain what went wrong and move on instead of the whole call dying.
 */
export function errorResult(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text", text: message }], isError: true };
}

export const fieldShape = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string(),
});

export const datasetShape = {
  id: z.string(),
  name: z.string(),
  title: z.string(),
  description: z.string(),
  kind: z.string(),
  fileName: z.string().nullable(),
  mimeType: z.string().nullable(),
  byteSize: z.number().nullable(),
  schema: z.array(fieldShape),
  sample: z.record(z.string(), z.unknown()),
  updatedAt: z.string(),
  url: z.string(),
};

export const coinShape = {
  id: z.string(),
  datasetId: z.string(),
  name: z.string(),
  symbol: z.string(),
  description: z.string().nullable(),
  mintAddress: z.string().nullable(),
  creatorWallet: z.string(),
  initialBuySol: z.string(),
  pumpFunUrl: z.string().nullable(),
  transactionSignature: z.string().nullable(),
  status: z.string(),
  createdAt: z.string(),
};

export function coinPayload(coin: Coin) {
  return {
    id: coin.id,
    datasetId: coin.datasetId,
    name: coin.name,
    symbol: coin.symbol,
    description: coin.description,
    mintAddress: coin.mintAddress,
    creatorWallet: coin.creatorWallet,
    initialBuySol: coin.initialBuySol,
    pumpFunUrl: coin.pumpFunUrl,
    transactionSignature: coin.transactionSignature,
    status: coin.status,
    createdAt: coin.createdAt,
  };
}

/** Reads. Stated once, applied to every read-only registration. */
export const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

/** Writes that create something on Realia, but destroy nothing. */
export const WRITES = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const;
