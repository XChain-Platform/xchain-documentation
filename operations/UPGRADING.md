# Upgrading

This document covers how to safely upgrade XChain services, apply database migrations, handle protocol version changes, and roll back if something goes wrong.

---

## Checking for Updates

xchain-node checks for new service versions from GitHub on every `preCheck()` call (which runs before every command). If a newer version is available, it will be noted in the CLI output.

To manually trigger an update check:
```bash
xchain-node ps
```

The hub is always updated automatically as part of this check.

---

## General Upgrade Process

The standard upgrade process is:

1. **Back up databases and volumes** (see below).
2. **Stop the affected service.**
3. **Pull and build the new image** via `xchain-node update`.
4. **Apply any database migrations** (if the release notes specify them).
5. **Start the service.**
6. **Verify operation** — check logs and confirm block processing resumes.

### Example: Upgrading the Indexer

```bash
# 1. Back up the indexer database
docker exec xchain-node-database mysqldump -u root \
  XChain_BTC_Mainnet_Indexer > indexer-backup-$(date +%Y%m%d).sql

# 2. Stop the indexer
xchain-node stop xchain-indexer bitcoin mainnet

# 3. Update to latest
xchain-node update xchain-indexer bitcoin mainnet

# 4. Start the indexer
xchain-node start xchain-indexer bitcoin mainnet

# 5. Verify
xchain-node tail xchain-indexer bitcoin mainnet
```

### Updating All Services

```bash
xchain-node update all bitcoin mainnet
```

This updates all services for the given chain and network in sequence.

---

## Rolling Upgrades

Some services can be upgraded independently with minimal disruption:

| Service | Can upgrade independently? | Notes |
|---|---|---|
| xchain-hub | Yes | Brief downtime; explorer will retry config sync |
| xchain-explorer | Yes | No state; stateless reads from DB |
| xchain-encoder | Yes | Stateless; no persistent data |
| xchain-decoder | With care | Brief gap in mempool tracking during restart |
| xchain-indexer | With care | Resumes from last processed block automatically |
| xchain-utxo-tracker | With care | Resumes from last parsed block |
| MariaDB (database) | No — coordinate | All services that use the DB will lose connections |
| Coin node | No — coordinate | Decoder and UTXO tracker will disconnect |

For the decoder and indexer, a brief restart causes no data loss — they resume from where they left off in the database on startup.

---

## Database Migrations

Some releases include schema changes (new tables, new columns, modified indexes). The release notes will indicate when a migration is required.

Migrations are applied by running the provided SQL files against the target database. The decoder and indexer both auto-create tables from their `src/sql/*.sql` files on startup using `IF NOT EXISTS` semantics, so adding new tables is handled automatically.

For column-level changes, a migration SQL file will be provided. Apply it while the service is stopped:

```bash
# Stop the service
xchain-node stop xchain-indexer bitcoin mainnet

# Apply migration
docker exec -i xchain-node-database mysql -u root XChain_BTC_Mainnet_Indexer \
  < migration-v2.sql

# Restart
xchain-node start xchain-indexer bitcoin mainnet
```

Always test migrations on regtest before applying to mainnet.

---

## Protocol Version Changes

The indexer uses the `ProtocolChanges` class (`src/protocol_changes.js`) to define which ACTIONs are valid and when new protocol features activate. Protocol changes are tied to block heights (mainnet) or timestamps.

When a new protocol version is deployed:

- The indexer image contains the updated `protocol_changes.js`.
- At the activation block, new ACTION types or field formats become valid.
- Old ACTION versions continue to be accepted if they were valid before activation.

No manual intervention is needed for protocol version changes — upgrading the indexer image is sufficient. The activation block/height is enforced automatically.

---

## Breaking Changes

A breaking change requires coordinated upgrades — for example, if the indexer DB schema changes in a way that is incompatible with the current explorer or decoder.

Breaking changes are flagged in release notes. When a breaking change affects multiple services:

1. Stop all affected services.
2. Apply any required database migrations.
3. Upgrade all affected services.
4. Start them in dependency order: hub → database → decoder → indexer → explorer.

---

## Backup Before Upgrading

Always back up before any upgrade that touches the database.

### MariaDB

```bash
# Backup all XChain databases
docker exec xchain-node-database mysqldump -u root \
  --databases \
  XChain_BTC_Mainnet_Decoder XChain_BTC_Mainnet_Indexer \
  XChain_LTC_Mainnet_Decoder XChain_LTC_Mainnet_Indexer \
  XChain_DOGE_Mainnet_Decoder XChain_DOGE_Mainnet_Indexer \
  > xchain-full-backup-$(date +%Y%m%d).sql
```

### LevelDB (UTXO Tracker, Hub)

```bash
xchain-node bootstrap create xchain-utxo-tracker bitcoin mainnet
```

For the hub, stop it, copy the volume, then restart:
```bash
xchain-node stop xchain-hub
docker run --rm -v xchain-node-xchain-hub_data:/data \
  -v $(pwd):/backup busybox tar czf /backup/hub-$(date +%Y%m%d).tar.gz /data
xchain-node start xchain-hub
```

---

## Rollback Procedure

If a new version causes problems, roll back to the previous version by re-installing from the previous git tag:

```bash
xchain-node stop xchain-indexer bitcoin mainnet

# Re-install from the previous release tag
xchain-node install v1.2.3 xchain-indexer bitcoin mainnet

xchain-node start xchain-indexer bitcoin mainnet
```

If the upgrade included a database migration, restore from the backup taken before upgrading:
```bash
xchain-node stop xchain-indexer bitcoin mainnet
docker exec -i xchain-node-database mysql -u root < indexer-backup-20250401.sql
xchain-node install v1.2.3 xchain-indexer bitcoin mainnet
xchain-node start xchain-indexer bitcoin mainnet
```

---

## Testing Upgrades on Regtest First

The recommended workflow for any non-trivial upgrade:

1. Install the new version on a regtest deployment.
2. Run the e2e test suite: `xchain-node install main xchain-e2e-test bitcoin regtest && xchain-node start xchain-e2e-test bitcoin regtest`.
3. Review e2e test results in the container logs.
4. If all tests pass, apply the upgrade to testnet, then mainnet.

This gives confidence that the new version handles the full ACTION pipeline correctly before touching production data.
