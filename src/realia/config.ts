export type RealiaConfig = {
  apiUrl: string;
  /** Null when no token is set: the public read tools still work. */
  apiToken: string | null;
};

export const DEFAULT_API_URL = "https://realiahq.xyz";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function trimTrailingSlash(url: string) {
  return url.replace(/\/+$/, "");
}

/**
 * An MCP server speaks JSON-RPC over stdout, so a bad URL has to fail before
 * the transport opens rather than as a log line that would corrupt the stream.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): RealiaConfig {
  const apiUrl = trimTrailingSlash(env.REALIA_API_URL?.trim() || DEFAULT_API_URL);
  try {
    new URL(apiUrl);
  } catch {
    throw new ConfigError(`REALIA_API_URL is not a valid URL: ${apiUrl}`);
  }
  return { apiUrl, apiToken: env.REALIA_API_TOKEN?.trim() || null };
}
