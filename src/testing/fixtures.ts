import type {
  Coin,
  Dataset,
  LaunchpadItem,
  RealiaClient,
} from "../realia/types.js";

export const sampleDatasets: Dataset[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "solar-output",
    title: "Rooftop solar output, Tehran",
    description: "Hourly generation from 42 rooftop installations.",
    kind: "upload",
    fileName: "solar-output.csv",
    mimeType: "text/csv",
    byteSize: 1_048_576,
    schema: [
      { name: "site_id", type: "string", description: "Installation id" },
      { name: "kwh", type: "number", description: "Energy generated" },
    ],
    sample: { site_id: "TH-04", kwh: 3.21 },
    updatedAt: "2026-09-02T09:00:00Z",
    url: "https://realiahq.xyz/datasets/11111111-1111-4111-8111-111111111111",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "13f-positions",
    title: "13F institutional positions",
    description: "Quarterly 13F-HR lines from EDGAR.",
    kind: "upload",
    fileName: "13f.csv",
    mimeType: "text/csv",
    byteSize: 4096,
    schema: [{ name: "cusip", type: "string", description: "Security CUSIP" }],
    sample: { cusip: "037833100" },
    updatedAt: "2026-09-01T09:00:00Z",
    url: "https://realiahq.xyz/datasets/22222222-2222-4222-8222-222222222222",
  },
];

export const sampleCoin: Coin = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  datasetId: sampleDatasets[0]!.id,
  name: "Tehran Solar",
  symbol: "SUN",
  description: "A coin on rooftop solar output.",
  imageUrl: null,
  mintAddress: "So11111111111111111111111111111111111111112",
  creatorWallet: "9xQeWvG816bUx9EPa2p4nU7Y1t1sQ1bJ5nJ6gJ8k2mNo",
  initialBuySol: "0.5",
  transactionSignature: "5sig",
  pumpFunUrl: "https://pump.fun/coin/So11111111111111111111111111111111111111112",
  status: "confirmed",
  createdAt: "2026-09-03T09:00:00Z",
  updatedAt: "2026-09-03T09:05:00Z",
};

export const sampleLaunchpadItem: LaunchpadItem = {
  id: sampleCoin.id,
  rwdId: sampleCoin.datasetId,
  name: sampleCoin.name,
  symbol: sampleCoin.symbol,
  description: sampleCoin.description ?? "",
  mintAddress: sampleCoin.mintAddress,
  pumpFunUrl: sampleCoin.pumpFunUrl,
  creatorWallet: sampleCoin.creatorWallet,
  initialBuySol: sampleCoin.initialBuySol,
  status: sampleCoin.status,
  createdAt: sampleCoin.createdAt,
  datasetTitle: sampleDatasets[0]!.title,
};

/** An in-memory client, so tests drive the real server without network. */
export function createMemoryRealiaClient(
  overrides: Partial<RealiaClient> = {},
): RealiaClient {
  const base: RealiaClient = {
    async searchDatasets(query, limit) {
      const term = query.trim().toLowerCase();
      const matched = term
        ? sampleDatasets.filter((dataset) =>
            [dataset.title, dataset.description, ...dataset.schema.map((f) => f.name)]
              .join(" ")
              .toLowerCase()
              .includes(term),
          )
        : sampleDatasets;
      return { datasets: matched.slice(0, limit), total: sampleDatasets.length };
    },
    async getDataset(id) {
      const dataset = sampleDatasets.find((item) => item.id === id);
      if (!dataset) return null;
      return { dataset, coin: dataset.id === sampleCoin.datasetId ? sampleCoin : null };
    },
    async listLaunchpad(_query, limit) {
      return {
        coins: [sampleLaunchpadItem].slice(0, limit),
        total: 1,
        launchpadUrl: "https://realiahq.xyz/launchpad",
      };
    },
    async getCoin(idOrMint) {
      if (idOrMint !== sampleCoin.id && idOrMint !== sampleCoin.mintAddress) return null;
      return { coin: sampleCoin, dataset: sampleDatasets[0]! };
    },
    async whoami() {
      return { userId: "did:privy:test", solanaAddresses: [sampleCoin.creatorWallet] };
    },
    async uploadDataset(input) {
      return {
        ...sampleDatasets[0]!,
        id: "33333333-3333-4333-8333-333333333333",
        title: input.title,
        description: input.description,
        fileName: input.fileName,
        mimeType: input.mimeType,
        byteSize: input.content.length,
      };
    },
    async stageLaunch(input) {
      return {
        intentId: "intent-1",
        confirmUrl: `https://realiahq.xyz/launch?intent=intent-1`,
        expiresAt: "2026-09-22T20:30:00Z",
        message: `Open confirmUrl to finish launching ${input.symbol}.`,
      };
    },
  };
  return { ...base, ...overrides };
}
