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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Talks to the Realia v1 API. Read endpoints are public; anything that writes
 * sends the user's personal token, so this server can never do more than the
 * person who configured it.
 */
export function createHttpRealiaClient(
  config: RealiaConfig,
  fetchImpl: typeof fetch = fetch,
): RealiaClient {
  function unexpected(path: string): never {
    throw new RealiaApiError(
      `Realia at ${config.apiUrl} answered ${path} with an unexpected shape. Check REALIA_API_URL.`,
      200,
      "unexpected_shape",
    );
  }

  function notJson(path: string, status: number, parsedJson: boolean): never {
    throw new RealiaApiError(
      parsedJson
        ? `Realia at ${config.apiUrl} answered ${path} with JSON that is not an object. Check REALIA_API_URL.`
        : `Realia at ${config.apiUrl} answered ${path} with a non-JSON body. Check REALIA_API_URL.`,
      status,
      "not_json",
    );
  }

  type CallInit = RequestInit & {
    auth?: "required" | "none";
    action?: string;
    /** Treat a JSON 404 as "no such thing" rather than an error. */
    missingIsNull?: boolean;
  };

  async function call<T>(path: string, init: CallInit & { missingIsNull: true }): Promise<T | null>;
  async function call<T>(path: string, init?: CallInit): Promise<T>;
  async function call<T>(path: string, init: CallInit = {}): Promise<T | null> {
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

    const raw = await response.text();
    let body: unknown = null;
    let parsedJson = false;
    if (raw.trim().length > 0) {
      try {
        body = JSON.parse(raw) as unknown;
        parsedJson = true;
      } catch {
        parsedJson = false;
      }
    }

    // An empty or JSON 404 on one resource is an answer ("no such dataset").
    // A 404 that carries HTML, or a 404 from a list endpoint, means this host
    // is not the Realia API — reporting that as "not found" or an empty list
    // would have the model announce that the dataset or the catalog does not exist.
    if (response.status === 404 && missingIsNull) {
      if (raw.trim().length > 0 && !parsedJson) notJson(path, response.status, false);
      return null;
    }

    if (!response.ok) {
      const parsed = isRecord(body) ? (body as ErrorBody) : {};
      const message = parsed.error?.message ?? `Realia returned ${response.status}.`;
      throw new RealiaApiError(
        response.status === 401
          ? `${message} Check REALIA_API_TOKEN, or remove it to use the public read tools.`
          : message,
        response.status,
        parsed.error?.code ?? (response.status === 401 ? "unauthorized" : "internal"),
      );
    }

    // A 200 carrying HTML, or JSON that is not an object, means something
    // answered that is not the Realia API — a proxy, a login wall, a wrong
    // host. Returning an empty result here would have the model report that
    // Realia holds nothing.
    if (!parsedJson || !isRecord(body)) notJson(path, response.status, parsedJson);

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
      const path = `/api/v1/datasets${query({ query: q, limit })}`;
      const result = await call<{ datasets: Dataset[]; total: number }>(path);
      if (!Array.isArray(result.datasets) || typeof result.total !== "number") unexpected(path);
      return result;
    },

    async getDataset(id) {
      const path = `/api/v1/datasets/${encodeURIComponent(id)}`;
      const result = await call<{ dataset: Dataset; coin: Coin | null }>(path, {
        missingIsNull: true,
      });
      if (!result) return null;
      if (!isRecord(result.dataset) || typeof result.dataset.id !== "string") unexpected(path);
      return result;
    },

    async listLaunchpad(q, limit) {
      const path = `/api/v1/coins${query({ query: q, limit })}`;
      const result = await call<{
        coins: LaunchpadItem[];
        total: number;
        launchpadUrl?: string;
      }>(path);
      if (!Array.isArray(result.coins) || typeof result.total !== "number") unexpected(path);
      return {
        coins: result.coins,
        total: result.total,
        launchpadUrl:
          typeof result.launchpadUrl === "string" && result.launchpadUrl.length > 0
            ? result.launchpadUrl
            : `${config.apiUrl}/launchpad`,
      };
    },

    async getCoin(idOrMint) {
      const path = `/api/v1/coins/${encodeURIComponent(idOrMint)}`;
      const result = await call<{ coin: Coin; dataset: Dataset | null }>(path, {
        missingIsNull: true,
      });
      if (!result) return null;
      if (!isRecord(result.coin) || typeof result.coin.id !== "string") unexpected(path);
      if (result.dataset != null && !isRecord(result.dataset)) unexpected(path);
      return result;
    },

    async whoami() {
      const path = "/api/v1/me";
      const result = await call<Identity>(path, {
        auth: "required",
        action: "Checking who the token belongs to",
      });
      if (typeof result.userId !== "string" || !Array.isArray(result.solanaAddresses)) {
        unexpected(path);
      }
      return result;
    },

    async uploadDataset(input: UploadInput) {
      const result = await call<{ dataset: Dataset }>("/api/v1/datasets", {
        method: "POST",
        body: JSON.stringify(input),
        auth: "required",
        action: "Uploading a dataset",
      });
      if (!isRecord(result.dataset) || typeof result.dataset.id !== "string") {
        throw new RealiaApiError("Upload did not return a dataset.", 500, "internal");
      }
      return result.dataset;
    },

    async stageLaunch(input: LaunchInput) {
      const { datasetId, ...body } = input;
      const path = `/api/v1/datasets/${encodeURIComponent(datasetId)}/launch`;
      const result = await call<StagedLaunch>(path, {
        method: "POST",
        body: JSON.stringify(body),
        auth: "required",
        action: "Staging a launch",
      });
      if (
        typeof result.intentId !== "string" ||
        typeof result.confirmUrl !== "string" ||
        typeof result.expiresAt !== "string"
      ) {
        throw new RealiaApiError("Realia returned no launch.", 500, "internal");
      }
      return result;
    },
  };
}
