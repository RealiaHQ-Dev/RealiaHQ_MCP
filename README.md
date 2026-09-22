# realia-mcp

An [MCP](https://modelcontextprotocol.io) server for [Realia](https://realiahq.xyz) — the launchpad for real-world data.

Realia is where someone publishes a dataset and launches a Solana coin on it through pump.fun. This server puts that in front of an agent, so Claude Code, Cursor, or anything else that speaks MCP can ask:

- *Which Realia dataset has wallet addresses in it?*
- *What does this dataset's schema look like before I write a parser against it?*
- *This mint is trending — what data is it actually backed by?*
- *Publish this CSV to Realia and set up a coin on it.*

It talks to the Realia API over HTTPS with **your** token. It holds no database credentials and can never see or do more than you can.

## Install

```bash
claude mcp add realia -- npx -y realia-mcp
```

Or by hand — this config works in Claude Code, Claude Desktop, Cursor, and anything else reading the standard MCP server format:

```json
{
  "mcpServers": {
    "realia": {
      "command": "npx",
      "args": ["-y", "realia-mcp"],
      "env": {
        "REALIA_API_TOKEN": "<your token>"
      }
    }
  }
}
```

### Getting a token

Sign in to [realiahq.xyz](https://realiahq.xyz), open **Account**, name a token and create it. The secret is shown **once** — copy it then. You can revoke it from the same page at any time, and a revoked token stops working immediately.

Without a token the four read tools still work against public data. `whoami`, `upload_dataset` and `launch_coin` need one.

| Variable | Required | Default |
| --- | --- | --- |
| `REALIA_API_TOKEN` | for writes | — |
| `REALIA_API_URL` | no | `https://realiahq.xyz` |

## Tools

**Reading (no token needed)**

- **`search_datasets`** — search by title, description, or **column name**, so `cusip` finds a dataset by what is inside it, not just by what it is called. Empty query returns the newest.
- **`get_dataset`** — one dataset in full: every column with type and description, a sample row, and the coin on it.
- **`list_launchpad`** — coins on the curve, newest first, with mint, pump.fun link, and the dataset behind each.
- **`get_coin`** — a mint address or coin id in; the coin plus the schema of its dataset out.

**Writing (token required)**

- **`whoami`** — which account the token belongs to, and its Solana wallets. Start here when a write fails.
- **`upload_dataset`** — publish a CSV, TSV, or JSON file (up to 8 MB) as text. Realia infers the schema and a sample row.
- **`launch_coin`** — stage a pump.fun launch and return a link to finish it.

Every tool returns prose for the model and `structuredContent` for code.

## What this cannot do

**It cannot spend your money.** `launch_coin` builds and signs nothing. It records the coin's details and returns a one-off link; you open that link in a browser and sign with your own wallet, exactly as if you had filled the form yourself. The link expires in 30 minutes and carries no authority on its own — ownership is checked again at launch. An agent, or anyone who takes your token, can at most *propose* a launch.

**It cannot read dataset files.** Schemas and sample rows are public; the files are not. An agent using this server should not claim to have read a dataset's contents.

## Development

```bash
pnpm install
pnpm test        # unit tests plus a full client↔server roundtrip over an in-memory transport
pnpm typecheck
pnpm build
pnpm dev         # run from source over stdio

# against a local Realia
REALIA_API_URL=http://localhost:3000 REALIA_API_TOKEN=… pnpm dev
```

Every call goes through the `RealiaClient` interface in [`src/realia/types.ts`](src/realia/types.ts); the HTTP implementation is in [`src/realia/http.ts`](src/realia/http.ts). Tools never build a request themselves, so the test suite drives the real server against an in-memory client.

## License

MIT
