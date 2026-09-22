#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./realia/config.js";
import { createRealiaServer } from "./server.js";

/**
 * stdout carries JSON-RPC frames, so nothing here may print to it. Every
 * diagnostic goes to stderr, which MCP clients surface as server logs.
 */
async function main() {
  const config = loadConfig();
  const server = createRealiaServer({ config });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `[realia-mcp] ready · ${config.apiUrl} · ${
      config.apiToken ? "token set" : "read-only (no REALIA_API_TOKEN)"
    }`,
  );
}

main().catch((error: unknown) => {
  console.error(`[realia-mcp] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
