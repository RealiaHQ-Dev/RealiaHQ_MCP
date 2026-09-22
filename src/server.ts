import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerReadTools } from "./tools/read.js";
import { registerWriteTools } from "./tools/write.js";
import type { RealiaConfig } from "./realia/config.js";
import { createHttpRealiaClient } from "./realia/http.js";
import type { RealiaClient } from "./realia/types.js";

export const SERVER_NAME = "realia";
export const SERVER_VERSION = "0.2.0";

export const SERVER_INSTRUCTIONS = `Realia is a launchpad for real-world data: someone publishes a dataset and launches a
Solana coin on it through pump.fun. This server talks to the Realia API as the
user who issued its API token.

Reading is open to everyone: search_datasets matches column names, not just
titles, so "which dataset has wallet addresses in it?" is answerable, and
get_coin goes from a mint back to the data behind it.

upload_dataset and launch_coin act as the token's owner. launch_coin does not
launch anything by itself — it returns a link the user opens to sign with their
own wallet. Always give them that link rather than implying the coin is live.

Dataset files are not public. Schemas and sample rows are; row-level data is
not, so do not claim to have read a dataset's contents.`;

export type CreateServerOptions = {
  config: RealiaConfig;
  /** Injected in tests; defaults to the HTTP client. */
  client?: RealiaClient;
};

export function createRealiaServer({ config, client }: CreateServerOptions): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} }, instructions: SERVER_INSTRUCTIONS },
  );

  const context = { client: client ?? createHttpRealiaClient(config) };
  registerReadTools(server, context);
  registerWriteTools(server, context);

  return server;
}
