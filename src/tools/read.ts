import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { coinDetail, datasetDetail, datasetLine, launchpadLine } from "../realia/format.js";
import {
  READ_ONLY,
  coinPayload,
  coinShape,
  datasetShape,
  errorResult,
  fieldShape,
  limitSchema,
  textResult,
  type ToolContext,
} from "./shared.js";

export function registerReadTools(server: McpServer, { client }: ToolContext) {
  server.registerTool(
    "search_datasets",
    {
      title: "Search Realia datasets",
      description:
        "Search the real-world datasets published on Realia by title, description, or column name. " +
        "Returns each dataset's id, size, and field names. Leave the query empty for the newest ones. " +
        "Use get_dataset for the full schema and a sample row.",
      inputSchema: {
        query: z
          .string()
          .trim()
          .default("")
          .describe("Free text, e.g. 'solar output', 'cusip'. Matches column names too."),
        limit: limitSchema.describe("How many datasets to return (1-50)."),
      },
      outputSchema: {
        datasets: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            description: z.string(),
            fieldNames: z.array(z.string()),
            byteSize: z.number().nullable(),
            url: z.string(),
          }),
        ),
        total: z.number().describe("How many datasets exist before filtering."),
      },
      annotations: READ_ONLY,
    },
    async ({ query, limit }) => {
      const term = query.replace(/\s+/g, " ").trim();
      const shown = term.replaceAll('"', "'");
      try {
        const { datasets, total } = await client.searchDatasets(term, limit);
        const summary =
          datasets.length === 0
            ? term
              ? `No dataset matched "${shown}".`
              : "No datasets on Realia."
            : term
              ? `${datasets.length} dataset${datasets.length === 1 ? "" : "s"} matching "${shown}" (of ${total}).`
              : `Newest ${datasets.length} of ${total} datasets on Realia.`;
        return textResult(
          datasets.length === 0
            ? summary
            : `${summary}\n\n${datasets.map((dataset) => datasetLine(dataset)).join("\n\n")}`,
          {
            datasets: datasets.map((dataset) => ({
              id: dataset.id,
              title: dataset.title,
              description: dataset.description,
              fieldNames: dataset.schema.map((field) => field.name),
              byteSize: dataset.byteSize,
              url: dataset.url,
            })),
            total,
          },
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "get_dataset",
    {
      title: "Get a Realia dataset",
      description:
        "Read one dataset in full: every column with type and description, one sample row, and the " +
        "coin launched on it if there is one. The file itself is not public — this returns the schema " +
        "and sample only.",
      inputSchema: {
        dataset_id: z.string().trim().min(1).describe("Dataset id from search_datasets."),
      },
      outputSchema: {
        found: z.boolean(),
        dataset: z.object(datasetShape).nullable(),
        coin: z.object(coinShape).nullable(),
      },
      annotations: READ_ONLY,
    },
    async ({ dataset_id }) => {
      try {
        const result = await client.getDataset(dataset_id);
        if (!result) {
          return textResult(
            `No dataset with id "${dataset_id}". Run search_datasets to find one.`,
            { found: false, dataset: null, coin: null },
          );
        }
        return textResult(datasetDetail(result.dataset, result.coin), {
          found: true,
          dataset: result.dataset,
          coin: result.coin ? coinPayload(result.coin) : null,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "list_launchpad",
    {
      title: "List Realia launchpad coins",
      description:
        "List the coins launched on Realia datasets, newest first, with mint address, pump.fun link, " +
        "status, and the dataset each one is backed by.",
      inputSchema: {
        query: z
          .string()
          .trim()
          .default("")
          .describe("Optional filter on coin name or symbol."),
        limit: limitSchema.describe("How many coins to return (1-50)."),
      },
      outputSchema: {
        coins: z.array(
          z.object({
            id: z.string(),
            datasetId: z.string(),
            name: z.string(),
            symbol: z.string(),
            mintAddress: z.string().nullable(),
            pumpFunUrl: z.string().nullable(),
            status: z.string(),
            initialBuySol: z.string(),
            datasetTitle: z.string().nullable(),
            createdAt: z.string(),
          }),
        ),
        total: z.number(),
        launchpadUrl: z.string(),
      },
      annotations: READ_ONLY,
    },
    async ({ query, limit }) => {
      const term = query.replace(/\s+/g, " ").trim();
      const shown = term.replaceAll('"', "'");
      try {
        const { coins, total, launchpadUrl } = await client.listLaunchpad(term, limit);
        const summary =
          coins.length === 0
            ? term
              ? `No coin matched "${shown}".`
              : "No coins on the Realia launchpad."
            : term
              ? `${coins.length} coin${coins.length === 1 ? "" : "s"} matching "${shown}" (of ${total} live).`
              : `Newest ${coins.length} of ${total} live coins on Realia.`;
        return textResult(
          coins.length === 0 ? summary : `${summary}\n\n${coins.map(launchpadLine).join("\n\n")}`,
          {
            coins: coins.map((item) => ({
              id: item.id,
              datasetId: item.rwdId,
              name: item.name,
              symbol: item.symbol,
              mintAddress: item.mintAddress,
              pumpFunUrl: item.pumpFunUrl,
              status: item.status,
              initialBuySol: item.initialBuySol,
              datasetTitle: item.datasetTitle,
              createdAt: item.createdAt,
            })),
            total,
            launchpadUrl,
          },
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "get_coin",
    {
      title: "Get a Realia coin",
      description:
        "Look up one coin by mint address or coin id, and get the dataset behind it — including that " +
        "dataset's schema. Answers 'what data is this coin actually backed by?'.",
      inputSchema: {
        id_or_mint: z
          .string()
          .trim()
          .min(1)
          .describe("A Solana mint address or a Realia coin id."),
      },
      outputSchema: {
        found: z.boolean(),
        coin: z.object(coinShape).nullable(),
        dataset: z
          .object({
            id: z.string(),
            title: z.string(),
            description: z.string(),
            schema: z.array(fieldShape),
            url: z.string(),
          })
          .nullable(),
      },
      annotations: READ_ONLY,
    },
    async ({ id_or_mint }) => {
      try {
        const result = await client.getCoin(id_or_mint);
        if (!result) {
          return textResult(`No Realia coin found for ${id_or_mint}.`, {
            found: false,
            coin: null,
            dataset: null,
          });
        }
        const { coin, dataset } = result;
        const text = [
          coinDetail(coin),
          "",
          "## Dataset behind it",
          dataset
            ? datasetLine(dataset)
            : `_Dataset \`${coin.datasetId}\` is no longer readable._`,
        ].join("\n");
        return textResult(text, {
          found: true,
          coin: coinPayload(coin),
          dataset: dataset
            ? {
                id: dataset.id,
                title: dataset.title,
                description: dataset.description,
                schema: dataset.schema,
                url: dataset.url,
              }
            : null,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
