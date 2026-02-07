<p align="center">
  <img src="https://raw.githubusercontent.com/clawsdk/Claw-SDK/main/assets/bannermoltsdk.png" alt="Claw SDK Banner" width="100%" />
</p>

# Claw SDK

[![npm version](https://img.shields.io/npm/v/claw-sdk.svg)](https://www.npmjs.com/package/claw-sdk)
[![npm downloads](https://img.shields.io/npm/dm/claw-sdk.svg)](https://www.npmjs.com/package/claw-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

A toolkit for developing and integrating OpenClaw AI agents into your projects. Build powerful, autonomous digital agents to automate tasks, manage data, and interact with other systems.

**[npm package](https://www.npmjs.com/package/claw-sdk)** | **[Documentation](https://docs.openclaw.ai)** | **[OpenClaw AI](https://openclaw.ai)**

## Installation

```bash
npm install claw-sdk
```

## Quick Start

```typescript
import { ClawClient } from 'claw-sdk';

const client = new ClawClient({
  apiKey: 'your-api-key',
});

// Create an agent
const agent = await client.agents.create({
  name: 'My Assistant',
  description: 'A helpful AI agent',
  model: 'openclaw-1',
  instructions: 'You are a helpful assistant that answers questions.',
});

// Chat with the agent
const response = await client.agents.chat(agent.id, {
  message: 'Hello! What can you do?',
});

console.log(response.message.content);
```

## Memecoin Trading with AI

Claw SDK includes a built-in **AI-powered memecoin trading agent**. The Claw agent analyzes on-chain data, social signals, and market trends to identify and execute memecoin trades autonomously.

```typescript
import { ClawClient } from 'claw-sdk';

const client = new ClawClient({ apiKey: 'your-api-key' });

// Create a memecoin trading agent
const trader = await client.agents.create({
  name: 'Memecoin Trader',
  model: 'openclaw-1',
  instructions: 'Analyze memecoin markets and execute profitable trades.',
  tools: [
    { name: 'market_scanner', type: 'function', description: 'Scan DEX for new memecoin launches', parameters: {} },
    { name: 'sentiment_analyzer', type: 'function', description: 'Analyze social media sentiment', parameters: {} },
    { name: 'trade_executor', type: 'function', description: 'Execute buy/sell orders on DEX', parameters: {} },
  ],
});

// Start the trading agent
await client.agents.start(trader.id);

// Monitor trades via streaming
await client.streaming.streamChat(trader.id,
  { message: 'Start scanning for high-potential memecoins' },
  {
    onMessage: (event) => console.log('Trade signal:', event.data),
  }
);
```

### Trading Features

- **On-chain analysis** — Real-time monitoring of DEX liquidity, holder distribution, and token metrics
- **Social sentiment** — AI-driven analysis of Twitter, Telegram, and Discord for early memecoin signals
- **Auto-trading** — Autonomous buy/sell execution with configurable risk parameters
- **Risk management** — Built-in stop-loss, take-profit, and position sizing
- **Multi-DEX support** — Trade across Raydium, Jupiter, Uniswap, and more
- **Portfolio tracking** — Real-time P&L tracking and performance analytics

## Features

- **AI Memecoin Trading** — Autonomous memecoin trading powered by the Claw AI agent
- **Autonomous AI agents** — Create intelligent agents that can perform tasks without human intervention
- **Agent Management** — Create, configure, start, stop, and manage AI agents
- **Task Automation** — Schedule and run automated tasks with priority queues
- **Data Management** — Key-value stores for agent memory and application data
- **Streaming** — Real-time Server-Sent Events for live agent responses
- **Webhooks** — Event-driven notifications for agent activity
- **Integration with messengers** — Works with popular messengers such as Telegram, Slack, Discord, and more
- **TypeScript** — Full type safety with comprehensive type definitions
- **Error Handling** — Typed errors with automatic retries and rate limiting
- **Lightweight** — Zero dependencies, uses native `fetch`

## Usage

### Agent Management

```typescript
// List all agents
const agents = await client.agents.list();

// Get a specific agent
const agent = await client.agents.get('agent-id');

// Update an agent
await client.agents.update('agent-id', {
  instructions: 'Updated instructions',
});

// Start / Stop / Pause
await client.agents.start('agent-id');
await client.agents.stop('agent-id');
await client.agents.pause('agent-id');

// Delete an agent
await client.agents.delete('agent-id');
```

### Task Automation

```typescript
// Create a task
const task = await client.tasks.create({
  agentId: 'agent-id',
  name: 'Data Analysis',
  description: 'Analyze the latest sales data',
  priority: 'high',
  input: { dataset: 'sales-q4' },
});

// Check task status
const status = await client.tasks.get(task.id);
console.log(status.status); // 'running' | 'completed' | 'failed'

// Get task result
const result = await client.tasks.getResult(task.id);

// List tasks by agent
const tasks = await client.tasks.list({ agentId: 'agent-id', status: 'completed' });
```

### Streaming Responses

```typescript
await client.streaming.streamChat('agent-id',
  { message: 'Tell me a story' },
  {
    onMessage: (event) => {
      if (event.type === 'message.delta') {
        process.stdout.write(event.data as string);
      }
    },
    onComplete: () => console.log('\nDone!'),
    onError: (err) => console.error('Error:', err),
  }
);
```

### Data Management

```typescript
// Create a data store
const store = await client.data.createStore({
  name: 'user-preferences',
  agentId: 'agent-id',
});

// Set and get values
await client.data.set(store.id, 'theme', 'dark');
const item = await client.data.get(store.id, 'theme');

// Query data
const results = await client.data.query(store.id, {
  filter: { category: 'settings' },
  sort: { field: 'createdAt', order: 'desc' },
  limit: 10,
});
```

### Webhooks

```typescript
// Register a webhook
const webhook = await client.webhooks.create({
  url: 'https://your-app.com/webhooks/claw',
  events: ['task.completed', 'agent.error'],
});

// Verify incoming webhook payloads
const isValid = client.webhooks.verifySignature(
  requestBody,
  requestHeaders['x-claw-signature'],
  webhook.secret,
);
```

## Configuration

```typescript
const client = new ClawClient({
  apiKey: 'your-api-key',           // Required
  baseUrl: 'https://api.openclaw.ai/v1',  // Optional, default API endpoint
  timeout: 30000,                   // Optional, request timeout in ms
  maxRetries: 3,                    // Optional, retry count for failed requests
  logLevel: 'info',                 // Optional: 'debug' | 'info' | 'warn' | 'error' | 'silent'
});
```

## Error Handling

```typescript
import { ClawClient, AuthenticationError, RateLimitError, NotFoundError } from 'claw-sdk';

try {
  const agent = await client.agents.get('non-existent-id');
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key');
  } else if (error instanceof RateLimitError) {
    console.error(`Rate limited. Retry after ${error.retryAfter}s`);
  } else if (error instanceof NotFoundError) {
    console.error('Agent not found');
  }
}
```

## Documentation

- **OpenClaw AI**: [https://openclaw.ai](https://openclaw.ai)
- **API Documentation**: [https://docs.openclaw.ai](https://docs.openclaw.ai)

## Requirements

- Node.js >= 16.0.0
- TypeScript >= 4.7 (for TypeScript users)

## License

MIT
