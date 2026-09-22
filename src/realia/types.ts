/**
 * The wire shapes of the Realia v1 API. This server is a client of
 * realiahq.xyz — it holds no database credentials and can see exactly what the
 * user's own API token is allowed to see.
 */

export type DatasetField = {
  name: string;
  type: string;
  description: string;
};

export type Dataset = {
  id: string;
  name: string;
  title: string;
  description: string;
  kind: "catalog" | "upload";
  fileName: string | null;
  mimeType: string | null;
  byteSize: number | null;
  schema: DatasetField[];
  /** One representative row. The file itself stays on Realia. */
  sample: Record<string, unknown>;
  updatedAt: string;
  url: string;
};

export type Coin = {
  id: string;
  datasetId: string;
  name: string;
  symbol: string;
  description: string | null;
  imageUrl: string | null;
  mintAddress: string | null;
  creatorWallet: string;
  initialBuySol: string;
  transactionSignature: string | null;
  pumpFunUrl: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

/** The launchpad roll carries the dataset title alongside each coin. */
export type LaunchpadItem = {
  id: string;
  rwdId: string;
  name: string;
  symbol: string;
  description: string;
  mintAddress: string | null;
  pumpFunUrl: string | null;
  creatorWallet: string;
  initialBuySol: string;
  status: string;
  createdAt: string;
  datasetTitle: string | null;
};

export type Identity = {
  userId: string;
  solanaAddresses: string[];
};

export type StagedLaunch = {
  intentId: string;
  confirmUrl: string;
  expiresAt: string;
  message: string;
};

export type UploadInput = {
  title: string;
  description: string;
  fileName: string;
  mimeType: string;
  content: string;
};

export type LaunchInput = {
  datasetId: string;
  name: string;
  symbol: string;
  description: string;
  imageUrl?: string;
  initialBuySol: string;
};

/**
 * Everything the tools call. Tests pass an in-memory implementation, so no tool
 * ever builds a request itself.
 */
export type RealiaClient = {
  searchDatasets(query: string, limit: number): Promise<{ datasets: Dataset[]; total: number }>;
  getDataset(id: string): Promise<{ dataset: Dataset; coin: Coin | null } | null>;
  listLaunchpad(
    query: string,
    limit: number,
  ): Promise<{ coins: LaunchpadItem[]; total: number; launchpadUrl: string }>;
  getCoin(idOrMint: string): Promise<{ coin: Coin; dataset: Dataset | null } | null>;
  whoami(): Promise<Identity>;
  uploadDataset(input: UploadInput): Promise<Dataset>;
  stageLaunch(input: LaunchInput): Promise<StagedLaunch>;
};
