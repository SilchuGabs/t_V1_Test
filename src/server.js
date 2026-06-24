#!/usr/bin/env node
/**
 * server.js — MCP server: read-only TradingView indicator access.
 *
 * Tools exposed:
 *   list_my_indicators      — see your saved private indicator names
 *   get_indicator_snapshot  — latest live values of a named indicator
 *   get_indicator_history   — historical values for a date range
 *
 * Deliberately NOT included, by design: anything that places an order,
 * touches a broker, or modifies your TradingView account. This server has
 * no write/execution path at all.
 */
import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { listPrivateIndicators, getLiveSnapshot, getHistoricalValues, closeClient } from './tv-client.js';

const server = new Server(
  { name: 'pltr-vwap-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

const TOOLS = [
  {
    name: 'list_my_indicators',
    description: 'List the names of every private/custom indicator saved on your TradingView account.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_indicator_snapshot',
    description: 'Get the latest live values of one of your private indicators on a symbol/timeframe. Read-only — does not place orders.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'e.g. "NASDAQ:PLTR"' },
        timeframe: { type: 'string', description: 'TradingView style, e.g. "5" for 5-minute, "60" for 1h, "D" for daily' },
        indicator: { type: 'string', description: 'Substring to match your indicator name, e.g. "15A" or "Master"' },
      },
      required: ['symbol', 'timeframe', 'indicator'],
    },
  },
  {
    name: 'get_indicator_history',
    description: 'Get historical values of one of your private indicators over a number of past bars. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string' },
        timeframe: { type: 'string' },
        indicator: { type: 'string' },
        range: { type: 'number', description: 'Number of bars back to fetch (default 300)' },
      },
      required: ['symbol', 'timeframe', 'indicator'],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'list_my_indicators') {
      const list = await listPrivateIndicators();
      return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
    }

    if (name === 'get_indicator_snapshot') {
      const result = await getLiveSnapshot(args.symbol, args.timeframe, args.indicator);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    if (name === 'get_indicator_history') {
      const result = await getHistoricalValues(args.symbol, args.timeframe, args.indicator, args.range || 300);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (err) {
    return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
  }
});

process.on('SIGINT', () => { closeClient(); process.exit(0); });
process.on('SIGTERM', () => { closeClient(); process.exit(0); });

const transport = new StdioServerTransport();
await server.connect(transport);
