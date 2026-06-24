# pltr-vwap-mcp

Read-only MCP server that reads YOUR private TradingView indicator (the VWAP
cloud + EMA ribbon framework) and exposes it as tools Claude can call.

## Scope — read this first

- **Read-only.** This connects to TradingView's data session the same way
  your browser does when you have a chart open, and reads indicator values.
  It does not place orders, does not touch a broker, and has no execution
  path of any kind.
- **No trade execution is included, on purpose.** Several similar projects
  bundle a live-trading bot. This one deliberately does not — if you ever
  want that, it should be a separate, explicit decision, not something
  baked into a charting tool by default.
- **Credentials stay local.** Your TradingView session cookies live only in
  your local `.env` file, which is gitignored. Never paste them into a chat
  with Claude or anyone else — they grant the same access a password would.

## Setup

1. `npm install`
2. `cp .env.example .env` and fill in `TV_SESSION`, `TV_SIGNATURE`, `TV_USERNAME`
   (instructions are inside `.env.example` — pulled from your own browser's
   cookies, never your literal password)
3. Add to your Claude Code / Claude Desktop MCP config:
   ```json
   {
     "mcpServers": {
       "pltr-vwap": {
         "command": "node",
         "args": ["/absolute/path/to/pltr-vwap-mcp/src/server.js"]
       }
     }
   }
   ```
4. Restart Claude Code / Desktop.

## Tools

| Tool | What it does |
|---|---|
| `list_my_indicators` | Lists every private indicator saved on your account, so you can find the exact name to target |
| `get_indicator_snapshot` | Latest live values of a named indicator on a symbol/timeframe |
| `get_indicator_history` | Historical values over N past bars, for backtesting or reviewing a past session |

Example, once connected: *"Use get_indicator_snapshot for NASDAQ:PLTR on the
5-minute timeframe, indicator name '15A'."*

## A note on what this can't promise

This depends on TradingView's internal data protocol, accessed through an
unofficial library, not an official API. It can break if TradingView changes
that protocol. Treat it as a working tool, not a guaranteed one — if a call
fails, check `list_my_indicators` first to confirm the connection itself is
alive before assuming the indicator logic is wrong.

## Credit

Built using architectural patterns drawn from several open-source
TradingView/MCP projects (CDP-bridge designs, backtest-harness structure),
combined with `@mathieuc/tradingview` for the actual private-indicator
session access — the one approach among those examined that can read named,
custom indicator plots rather than only generic public indicators.
