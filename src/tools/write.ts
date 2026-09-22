import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { datasetDetail } from "../realia/format.js";
import {
  READ_ONLY,
  WRITES,
  datasetShape,
  errorResult,
  textResult,
  type ToolContext,
} from "./shared.js";

export function registerWriteTools(server: McpServer, { client }: ToolContext) {
  server.registerTool(
    "whoami",
    {
      title: "Check the Realia token",
      description:
        "Show which Realia account this server's API token belongs to, and the Solana wallets on it. " +
        "Use this first when an upload or launch fails with an authentication error.",
      inputSchema: {},
      outputSchema: {
        userId: z.string(),
        solanaAddresses: z.array(z.string()),
      },
      annotations: READ_ONLY,
    },
    async () => {
      try {
        const identity = await client.whoami();
        const wallets =
          identity.solanaAddresses.length === 0
            ? "No Solana wallet is linked to this account yet."
            : identity.solanaAddresses.map((address) => `- \`${address}\``).join("\n");
        return textResult(
          `Signed in as \`${identity.userId}\`.\n\n**Wallets**\n${wallets}`,
          identity,
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "upload_dataset",
    {
      title: "Upload a dataset to Realia",
      description:
        "Publish a CSV, TSV, or JSON dataset to Realia under the account this token belongs to. " +
        "Pass the file's text directly as `content`. Realia infers the schema and a sample row, and " +
        "the dataset becomes publicly searchable. Up to 8 MB.",
      inputSchema: {
        title: z.string().trim().min(1).max(120).describe("Human title, e.g. 'Rooftop solar output'."),
        description: z
          .string()
          .trim()
          .min(1)
          .max(2000)
          .describe("What the data is and where it came from. Required."),
        file_name: z
          .string()
          .trim()
          .min(1)
          .max(120)
          .describe("File name ending in .csv, .tsv, .txt, or .json."),
        content: z.string().min(1).describe("The full file contents as text."),
        mime_type: z
          .string()
          .trim()
          .default("text/csv")
          .describe("Content type, e.g. text/csv or application/json."),
      },
      outputSchema: {
        dataset: z.object(datasetShape),
      },
      annotations: WRITES,
    },
    async ({ title, description, file_name, content, mime_type }) => {
      try {
        const dataset = await client.uploadDataset({
          title,
          description,
          fileName: file_name,
          mimeType: mime_type,
          content,
        });
        return textResult(
          `Uploaded.\n\n${datasetDetail(dataset, null)}`,
          { dataset },
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "launch_coin",
    {
      title: "Start a coin launch on Realia",
      description:
        "Stage a pump.fun launch for a dataset this account uploaded, and return a link the user opens " +
        "to sign with their wallet. This tool cannot spend anything on its own: no transaction is built " +
        "or signed here, and the link expires. Give the user the returned confirmUrl.",
      inputSchema: {
        dataset_id: z.string().min(1).describe("A dataset uploaded by this account."),
        name: z.string().trim().min(1).max(32).describe("Coin name, up to 32 characters."),
        symbol: z.string().trim().min(1).max(10).describe("Ticker, up to 10 characters."),
        description: z.string().trim().max(500).default("").describe("Shown on pump.fun."),
        initial_buy_sol: z
          .string()
          .default("0.1")
          .describe("SOL the creator buys at launch, e.g. '0.1'."),
        image_url: z.string().url().optional().describe("Optional coin image URL."),
      },
      outputSchema: {
        intentId: z.string(),
        confirmUrl: z.string().describe("Open in a browser and sign to finish the launch."),
        expiresAt: z.string(),
      },
      annotations: WRITES,
    },
    async ({ dataset_id, name, symbol, description, initial_buy_sol, image_url }) => {
      try {
        const staged = await client.stageLaunch({
          datasetId: dataset_id,
          name,
          symbol,
          description,
          initialBuySol: initial_buy_sol,
          ...(image_url ? { imageUrl: image_url } : {}),
        });
        const text = [
          `**$${symbol.toUpperCase()}** is ready to launch on dataset \`${dataset_id}\`.`,
          "",
          "The wallet has to sign it. Open this link and confirm:",
          "",
          staged.confirmUrl,
          "",
          `The link expires at ${staged.expiresAt}. Nothing has been spent or signed yet.`,
        ].join("\n");
        return textResult(text, {
          intentId: staged.intentId,
          confirmUrl: staged.confirmUrl,
          expiresAt: staged.expiresAt,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
