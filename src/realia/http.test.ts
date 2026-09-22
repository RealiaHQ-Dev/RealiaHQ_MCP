import { describe, expect, it, vi } from "vitest";
import { createHttpRealiaClient, MissingTokenError, RealiaApiError } from "./http.js";
import { sampleDatasets } from "../testing/fixtures.js";

const config = { apiUrl: "https://realiahq.xyz", apiToken: "tok" };
const anonConfig = { apiUrl: "https://realiahq.xyz", apiToken: null };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("http client", () => {
  it("sends the token as a bearer header", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ datasets: [], total: 0 }));
    await createHttpRealiaClient(config, fetchImpl as unknown as typeof fetch).searchDatasets("", 10);
    const [, init] = fetchImpl.mock.calls[0]!;
    expect(new Headers((init as RequestInit).headers).get("authorization")).toBe("Bearer tok");
  });

  it("refuses a write with no token instead of calling the API", async () => {
    const fetchImpl = vi.fn();
    const client = createHttpRealiaClient(anonConfig, fetchImpl as unknown as typeof fetch);
    await expect(
      client.uploadDataset({
        title: "t",
        description: "d",
        fileName: "f.csv",
        mimeType: "text/csv",
        content: "a,b",
      }),
    ).rejects.toThrow(MissingTokenError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("still reads without a token", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ datasets: sampleDatasets, total: 2 }),
    );
    const result = await createHttpRealiaClient(
      anonConfig,
      fetchImpl as unknown as typeof fetch,
    ).searchDatasets("solar", 10);
    expect(result.total).toBe(2);
    const [, init] = fetchImpl.mock.calls[0]!;
    expect(new Headers((init as RequestInit).headers).has("authorization")).toBe(false);
  });

  it("turns 404 into 'no result', not an error", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 404));
    const client = createHttpRealiaClient(config, fetchImpl as unknown as typeof fetch);
    await expect(client.getDataset("missing")).resolves.toBeNull();
  });

  it("surfaces the API's own error message", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        { error: { code: "not_dataset_owner", message: "You can only launch your own." } },
        403,
      ),
    );
    const client = createHttpRealiaClient(config, fetchImpl as unknown as typeof fetch);
    await expect(
      client.stageLaunch({
        datasetId: "d",
        name: "n",
        symbol: "S",
        description: "",
        initialBuySol: "0.1",
      }),
    ).rejects.toThrow("You can only launch your own.");
  });

  it("names the host when the network is down", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const client = createHttpRealiaClient(config, fetchImpl as unknown as typeof fetch);
    await expect(client.searchDatasets("", 10)).rejects.toThrow(RealiaApiError);
    await expect(client.searchDatasets("", 10)).rejects.toThrow(/realiahq\.xyz/);
  });

  it("encodes a mint address into the path", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 404));
    await createHttpRealiaClient(config, fetchImpl as unknown as typeof fetch).getCoin("a/b");
    expect(fetchImpl.mock.calls[0]![0]).toBe("https://realiahq.xyz/api/v1/coins/a%2Fb");
  });
});

describe("a host with no Realia API", () => {
  it("reports the 404 instead of claiming Realia is empty", async () => {
    // Pointing at a deployment that predates /api/v1 used to answer
    // "no datasets", which the model would repeat as fact.
    const fetchImpl = vi.fn(async () => new Response("<!doctype html>", { status: 404 }));
    const client = createHttpRealiaClient(config, fetchImpl as unknown as typeof fetch);
    await expect(client.searchDatasets("", 10)).rejects.toThrow(RealiaApiError);
    await expect(client.listLaunchpad("", 10)).rejects.toThrow(/404/);
  });

  it("still treats a missing dataset or coin as simply absent", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 404 }));
    const client = createHttpRealiaClient(config, fetchImpl as unknown as typeof fetch);
    await expect(client.getDataset("nope")).resolves.toBeNull();
    await expect(client.getCoin("nope")).resolves.toBeNull();
  });
});

describe("a reply that is not the Realia API", () => {
  it("rejects a 200 carrying HTML rather than reporting an empty Realia", async () => {
    // A proxy, a login wall, or a wrong host all look like this.
    const fetchImpl = vi.fn(
      async () =>
        new Response("<html>login</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
    );
    const client = createHttpRealiaClient(config, fetchImpl as unknown as typeof fetch);
    await expect(client.searchDatasets("", 10)).rejects.toThrow(/non-JSON/);
    await expect(client.searchDatasets("", 10)).rejects.toThrow(/REALIA_API_URL/);
  });
});
