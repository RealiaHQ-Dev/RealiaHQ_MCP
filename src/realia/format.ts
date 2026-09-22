import type { Coin, Dataset, LaunchpadItem } from "./types.js";

/**
 * Tools answer twice: `structuredContent` for code, and this text for the
 * model. The text stays compact — a listing that dumps every field of every
 * dataset crowds out the reasoning that follows it.
 */

export function formatBytes(bytes: number | null) {
  if (bytes === null || !Number.isFinite(bytes) || bytes <= 0) return "unknown size";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}

function shorten(text: string, max = 160) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function datasetLine(dataset: Dataset, coin?: Coin | null) {
  const fields = dataset.schema.length;
  const suffix = coin ? ` · coin $${coin.symbol} (${coin.status})` : "";
  return [
    `- **${dataset.title}** — \`${dataset.id}\``,
    `  ${shorten(dataset.description)}`,
    `  ${fields} field${fields === 1 ? "" : "s"} · ${formatBytes(dataset.byteSize)}${suffix}`,
    `  ${dataset.url}`,
  ].join("\n");
}

export function datasetDetail(dataset: Dataset, coin: Coin | null) {
  const lines = [
    `# ${dataset.title}`,
    "",
    dataset.description,
    "",
    `- id: \`${dataset.id}\``,
    `- file: ${dataset.fileName ?? "—"} (${dataset.mimeType ?? "—"}, ${formatBytes(dataset.byteSize)})`,
    `- updated: ${dataset.updatedAt}`,
    `- page: ${dataset.url}`,
    "",
    "## Schema",
  ];

  if (dataset.schema.length === 0) {
    lines.push("_No schema was recorded for this dataset._");
  } else {
    lines.push("| field | type | description |", "| --- | --- | --- |");
    for (const field of dataset.schema) {
      lines.push(`| \`${field.name}\` | ${field.type} | ${field.description || "—"} |`);
    }
  }

  lines.push("", "## Sample row");
  lines.push(
    Object.keys(dataset.sample).length === 0
      ? "_No sample row was recorded._"
      : ["```json", JSON.stringify(dataset.sample, null, 2), "```"].join("\n"),
  );

  lines.push("", "## Coin", coin ? coinDetail(coin) : "_No coin has been launched on this dataset._");
  lines.push(
    "",
    "_Only the schema and one sample row are public. The file itself stays on Realia._",
  );
  return lines.join("\n");
}

export function launchpadLine(item: LaunchpadItem) {
  const mint = item.mintAddress ? ` · mint \`${item.mintAddress}\`` : "";
  const on = item.datasetTitle ? ` on "${item.datasetTitle}"` : "";
  return [
    `- **$${item.symbol}** ${item.name}${on} — ${item.status}${mint}`,
    `  launched ${item.createdAt} · initial buy ${item.initialBuySol} SOL`,
    `  ${item.pumpFunUrl ?? "not on pump.fun yet"}`,
  ].join("\n");
}

export function coinDetail(coin: Coin) {
  const lines = [`**$${coin.symbol}** — ${coin.name}`];
  if (coin.description) lines.push("", coin.description);
  lines.push(
    "",
    `- status: ${coin.status}`,
    `- dataset id: \`${coin.datasetId}\``,
    `- mint: ${coin.mintAddress ? `\`${coin.mintAddress}\`` : "not minted yet"}`,
    `- creator wallet: \`${coin.creatorWallet}\``,
    `- initial buy: ${coin.initialBuySol} SOL`,
    `- launched: ${coin.createdAt}`,
  );
  if (coin.pumpFunUrl) lines.push(`- pump.fun: ${coin.pumpFunUrl}`);
  if (coin.mintAddress) lines.push(`- solscan: https://solscan.io/token/${coin.mintAddress}`);
  if (coin.transactionSignature) lines.push(`- tx: \`${coin.transactionSignature}\``);
  return lines.join("\n");
}
