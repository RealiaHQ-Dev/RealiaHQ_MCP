import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  createMemoryRealiaClient,
  sampleCoin,
  sampleDatasets,
} from "./testing/fixtures.js";
import { MissingTokenError } from "./realia/http.js";
import { createRealiaServer } from "./server.js";
import type { RealiaClient } from "./realia/types.js";

const config = { apiUrl: "https://realiahq.xyz", apiToken: "tok" };

/** Drives the server through a real MCP client, so schemas are validated too. */
async function connect(overrides: Partial<RealiaClient> = {}) {
  const server = createRealiaServer({
    config,
    client: createMemoryRealiaClient(overrides),
  });
  const client = new Client({ name: "test", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

function structured<T = Record<string, any>>(result: CallToolResult): T {
  return result.structuredContent as T;
}

function text(result: CallToolResult) {
  return result.content.map((part) => (part.type === "text" ? part.text : "")).join("\n");
}

describe("realia mcp server", () => {
  it("exposes the read tools and the write tools, marked apart", async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "get_coin",
      "get_dataset",
      "launch_coin",
      "list_launchpad",
      "search_datasets",
      "upload_dataset",
      "whoami",
    ]);
    const byName = new Map(tools.map((tool) => [tool.name, tool]));
    expect(byName.get("search_datasets")?.annotations?.readOnlyHint).toBe(true);
    expect(byName.get("upload_dataset")?.annotations?.readOnlyHint).toBe(false);
    expect(byName.get("launch_coin")?.annotations?.destructiveHint).toBe(false);
  });

  it("search_datasets matches a column name", async () => {
    const client = await connect();
    const result = (await client.callTool({
      name: "search_datasets",
      arguments: { query: "cusip" },
    })) as CallToolResult;
    const { datasets, total } = structured(result);
    expect(total).toBe(2);
    expect(datasets).toHaveLength(1);
    expect(datasets[0].fieldNames).toContain("cusip");
  });

  it("get_dataset returns schema, sample, and the coin", async () => {
    const client = await connect();
    const result = (await client.callTool({
      name: "get_dataset",
      arguments: { dataset_id: sampleDatasets[0]!.id },
    })) as CallToolResult;
    const { found, dataset, coin } = structured(result);
    expect(found).toBe(true);
    expect(dataset.schema).toHaveLength(2);
    expect(dataset.sample.kwh).toBe(3.21);
    expect(coin.symbol).toBe("SUN");
    expect(text(result)).toContain("stays on Realia");
  });

  it("get_dataset answers a miss without erroring", async () => {
    const client = await connect();
    const result = (await client.callTool({
      name: "get_dataset",
      arguments: { dataset_id: "nope" },
    })) as CallToolResult;
    expect(result.isError).toBeFalsy();
    expect(structured(result).found).toBe(false);
  });

  it("get_coin resolves a mint back to the dataset behind it", async () => {
    const client = await connect();
    const result = (await client.callTool({
      name: "get_coin",
      arguments: { id_or_mint: sampleCoin.mintAddress },
    })) as CallToolResult;
    const { found, dataset } = structured(result);
    expect(found).toBe(true);
    expect(dataset.schema.map((f: { name: string }) => f.name)).toContain("kwh");
  });

  it("upload_dataset publishes and reports back the stored dataset", async () => {
    const client = await connect();
    const result = (await client.callTool({
      name: "upload_dataset",
      arguments: {
        title: "Chip prices",
        description: "Weekly prices.",
        file_name: "chips.csv",
        content: "brand,price\nLay's,3",
      },
    })) as CallToolResult;
    const { dataset } = structured(result);
    expect(dataset.title).toBe("Chip prices");
    expect(dataset.fileName).toBe("chips.csv");
    expect(text(result)).toContain("Uploaded.");
  });

  it("launch_coin returns a link to sign and never claims the coin is live", async () => {
    const client = await connect();
    const result = (await client.callTool({
      name: "launch_coin",
      arguments: {
        dataset_id: sampleDatasets[0]!.id,
        name: "Tehran Solar",
        symbol: "sun",
        initial_buy_sol: "0.25",
      },
    })) as CallToolResult;
    const { confirmUrl, intentId } = structured(result);
    expect(intentId).toBe("intent-1");
    expect(confirmUrl).toContain("/launch?intent=");
    const body = text(result);
    expect(body).toContain("Nothing has been spent or signed yet");
    expect(body).toContain("$SUN");
  });

  it("tells the user to set a token instead of failing obscurely", async () => {
    const client = await connect({
      uploadDataset: async () => {
        throw new MissingTokenError("Uploading a dataset");
      },
    });
    const result = (await client.callTool({
      name: "upload_dataset",
      arguments: {
        title: "t",
        description: "d",
        file_name: "f.csv",
        content: "a,b",
      },
    })) as CallToolResult;
    expect(result.isError).toBe(true);
    expect(text(result)).toContain("REALIA_API_TOKEN");
  });

  it("reports a rejected launch as a tool error with the API's reason", async () => {
    const client = await connect({
      stageLaunch: async () => {
        throw new Error("You can only launch a coin for a dataset you uploaded.");
      },
    });
    const result = (await client.callTool({
      name: "launch_coin",
      arguments: { dataset_id: "d", name: "n", symbol: "N" },
    })) as CallToolResult;
    expect(result.isError).toBe(true);
    expect(text(result)).toContain("dataset you uploaded");
  });
});
