# XChain Platform Explorer

## What is xchain-explorer

xchain-explorer is the query and presentation layer of the XChain Platform. It runs as a long-lived Node.js/Express process that reads from the Indexer database and exposes over 50 endpoints through three interfaces: a REST API, a JSON-RPC 2.0 API, and a Bootstrap-based web block explorer. It does not write to any database.

The explorer is the primary integration point for wallets, exchanges, block explorers, and other applications that need to query XChain state.

## Features

- **Three interfaces** — REST, JSON-RPC 2.0, and a web UI served from the same process
- **50+ endpoints** — covering tokens, balances, transactions, market data, DEX state, addresses, blocks, files, and messages
- **Read-only** — the explorer never writes to the Indexer database
- **Config discovery from hub** — fetches configuration from xchain-hub on startup and refreshes every 60 seconds
- **SSL/TLS support** — production deployments serve HTTPS with configurable certificates
- **CORS configuration** — allowed origins configurable per deployment
- **Market data relay** — price feed endpoint for aggregating and forwarding fiat price data
- **Raw parameterized SQL** — approximately 5,500 lines of query logic with no ORM layer
- **Highcharts integration** — market data charts in the web UI

## Interfaces

### REST API

Standard HTTP endpoints using GET (queries) and POST (parameterized lookups). All responses are JSON. Endpoint paths follow the pattern `/api/v1/{category}/{method}`.

### JSON-RPC 2.0

The same functionality is available via POST to a single endpoint using the JSON-RPC 2.0 envelope format. This is the preferred interface for programmatic access — it supports batching and provides consistent error codes.

### Web UI

A Bootstrap-based web block explorer served from the same Express process. Pages cover:

- Token listing and individual token detail pages
- Address pages showing balances and transaction history
- Block detail pages
- Order book and trade history for DEX pairs
- Dispenser listings
- File content viewer
- Real-time charts using Highcharts

## Endpoint Categories

### Tokens

Query token metadata, supply, ownership, and listing state.

- Get token information by ticker
- List all tokens with filtering and pagination
- Search tokens by name, owner, or status
- Get token supply breakdown (issued, minted, destroyed)

### Balances

Query address holdings.

- Get all balances for an address
- Get a specific address's balance for a given token
- List all holders of a token with amounts
- Get locked (escrowed) balance for DEX orders or dispensers

### Transactions

Query decoded and indexed transaction data.

- Get transaction details by txid
- Get action details by action index
- List transactions for an address
- List transactions by block height

### Market

Price and trade data for the on-chain DEX.

- Current price for a trading pair
- 24-hour volume
- Order book depth
- Recent trade history
- OHLCV candlestick data

### DEX

Active DEX state.

- List open orders by pair or address
- Get dispenser details by txid or address
- List active dispensers for a token
- Swap listings and status

### Addresses

Address metadata and history.

- Address information (first seen, transaction count)
- Stored address preferences (ADDRESS action)
- Full transaction history with pagination

### Actions

Look up individual protocol actions.

- Action by index number
- Actions by type (e.g. all SEND actions)
- Actions by ticker
- Actions by source or destination address
- Actions by block height

### Blocks

Block-level data.

- Block information (height, hash, timestamp, tx count)
- All actions within a block

### Files

On-chain FILE action data.

- File lookup by action index or address
- File content retrieval (raw bytes or base64)
- File metadata (size, mime type, name)

### Messages

On-chain MESSAGE action data.

- Message lookup by action index
- Conversation history between two addresses
- Messages to or from an address

## Configuration

The explorer reads configuration from a local `config.json` or from xchain-hub via `getAllConfig()`. Hub-sourced config refreshes every 60 seconds, so connection string changes propagate without a restart.

| Parameter | Description |
|---|---|
| `coin` | Chain identifier — `BTC`, `LTC`, or `DOGE` |
| `network` | Network — `mainnet`, `testnet`, or `regtest` |
| `dbHost` | Indexer MariaDB hostname |
| `dbPort` | Indexer MariaDB port |
| `dbUser` | Indexer MariaDB username |
| `dbPass` | Indexer MariaDB password |
| `hubUrl` | URL of xchain-hub for config discovery |
| `port` | Explorer API and web UI port |
| `sslCert` | Path to TLS certificate (production) |
| `sslKey` | Path to TLS private key (production) |
| `corsOrigins` | Allowed CORS origins (comma-separated) |

## Database

The explorer reads from the Indexer MariaDB database named:

```
XChain_{CHAIN}_{NETWORK}_Indexer
```

Examples: `XChain_BTC_Mainnet_Indexer`, `XChain_DOGE_Regtest_Indexer`

All queries use raw parameterized SQL via the `mariadb` npm package. No ORM. Query logic is concentrated in approximately 5,500 lines across the service's query modules.

## Installation

Clone the repository and install dependencies from within the `xchain-explorer` directory:

```bash
git clone https://github.com/XChain-platform/xchain-explorer.git
cd xchain-explorer
npm install
npm run api
```

## Related

- [Indexer](../indexer/) — the service that produces the database the explorer reads
- [Hub](../hub/) — config oracle the explorer polls for connection details
- [Indexer Database Schema](../indexer/DATABASE.md) — full schema reference for the underlying tables
