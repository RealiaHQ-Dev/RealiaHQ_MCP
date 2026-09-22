import type { RealiaConfig } from "./config.js";
import type {
  Coin,
  Dataset,
  Identity,
  LaunchInput,
  LaunchpadItem,
  RealiaClient,
  StagedLaunch,
  UploadInput,
} from "./types.js";

export class RealiaApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "RealiaApiError";
    this.status = status;
    this.code = code;
  }
}

export class MissingTokenError extends Error {
  constructor(action: string) {
    super(
      `${action} needs a Realia API token. Create one at your account page on Realia, then set REALIA_API_TOKEN in this server's config.`,
    );
    this.name = "MissingTokenError";
  }
}

type ErrorBody = { error?: { code?: string; message?: string } };

/**
 * Talks to the Realia v1 API. Read endpoints are public; anything that writes
 * sends the user's personal token, so this server can never do more than the
 * person who configured it.
 */
export function createHttpRealiaClient(
  config: RealiaConfig,
  fetchImpl: typeof fetch = fetch,
): RealiaClient {
  async function call<T>(
    path: string,
    init: RequestInit & {
      auth?: "required" | "none";
      action?: string;
      /** Treat 404 as "no such thing" rather than an error. */
      missingIsNull?: boolean;
    } = {},
  ): Promise<T | null> {
    const { auth = "none", action = "This", missingIsNull = false, ...request } = init;
    if (auth === "required" && !config.apiToken) {
      throw new MissingTokenError(action);
    }

    const headers = new Headers(request.headers);
    headers.set("accept", "application/json");
    if (config.apiToken) headers.set("authorization", `Bearer ${config.apiToken}`);
    if (request.body) headers.set("content-type", "application/json");

    let response: Response;
    try {
      response = await fetchImpl(`${config.apiUrl}${path}`, { ...request, headers });
    } catch (error) {
      throw new RealiaApiError(
        `Could not reach Realia at ${config.apiUrl}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        0,
        "network",
      );
    }

    // For a single resource, 404 is an answer ("no such dataset"). For a list
    // endpoint it means this host has no Realia API — reporting that as an
    // empty result would have the model announce that Realia has no datasets.
    if (response.status === 404 && missingIsNull) return null;

    let body: unknown = null;
    let parsedJson = true;
    try {
      body = await response.json();
    } catch {
      parsedJson = false;
    }

    if (!response.ok) {
      const parsed = (body ?? {}) as ErrorBody;
      throw new RealiaApiError(
        parsed.error?.message ?? `Realia returned ${response.status}.`,
        response.status,
        parsed.error?.code ?? "internal",
      );
    }

    // A 200 carrying HTML means something answered that is not the Realia API
    // — a proxy, a login wall, a wrong host. Returning an empty result here
    // would have the model report that Realia holds nothing.
    if (!parsedJson) {
      throw new RealiaApiError(
        `Realia at ${config.apiUrl} answered ${path} with a non-JSON body. Check REALIA_API_URL.`,
        response.status,
        "not_json",
      );
    }

    return body as T;
  }

  function query(params: Record<string, string | number>) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== "") search.set(key, String(value));
    }
    const encoded = search.toString();
    return encoded ? `?${encoded}` : "";
  }

  return {
    async searchDatasets(q, limit) {
      const result = await call<{ datasets: Dataset[]; total: number }>(
        `/api/v1/datasets${query({ query: q, limit })}`,
      );
      return result ?? { datasets: [], total: 0 };
    },

    async getDataset(id) {
      return call<{ dataset: Dataset; coin: Coin | null }>(
        `/api/v1/datasets/${encodeURIComponent(id)}`,
        { missingIsNull: true },
      );
    },

    async listLaunchpad(q, limit) {
      const result = await call<{
        coins: LaunchpadItem[];
        total: number;
        launchpadUrl: string;
      }>(`/api/v1/coins${query({ query: q, limit })}`);
      return result ?? { coins: [], total: 0, launchpadUrl: `${config.apiUrl}/launchpad` };
    },

    async getCoin(idOrMint) {
      return call<{ coin: Coin; dataset: Dataset | null }>(
        `/api/v1/coins/${encodeURIComponent(idOrMint)}`,
        { missingIsNull: true },
      );
    },

    async whoami() {
      const result = await call<Identity>("/api/v1/me", {
        auth: "required",
        action: "Checking who the token belongs to",
      });
      if (!result) throw new RealiaApiError("Realia returned no identity.", 500, "internal");
      return result;
    },

    async uploadDataset(input: UploadInput) {
      const result = await call<{ dataset: Dataset }>("/api/v1/datasets", {
        method: "POST",
        body: JSON.stringify(input),
        auth: "required",
        action: "Uploading a dataset",
      });
      if (!result) throw new RealiaApiError("Upload did not return a dataset.", 500, "internal");
      return result.dataset;
    },

    async stageLaunch(input: LaunchInput) {
      const { datasetId, ...body } = input;
      const result = await call<StagedLaunch>(
        `/api/v1/datasets/${encodeURIComponent(datasetId)}/launch`,
        {
          method: "POST",
          body: JSON.stringify(body),
          auth: "required",
          action: "Staging a launch",
        },
      );
      if (!result) {
        throw new RealiaApiError("Realia returned no launch.", 500, "internal");
      }
      return result;
    },
  };
}
