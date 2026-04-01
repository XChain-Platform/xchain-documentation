# Gas and Fees

XChain uses its own fee token — **XCHAIN** — to pay for operations that write to the protocol's state. This gas mechanism funds infrastructure, prevents spam, and provides an economic layer independent of coin transaction fees.

## The XCHAIN Token

`XCHAIN` is a standard XChain token in every technical sense — it lives in the same ledger, transfers the same way, and appears in the same explorer. What makes it special is its designation as the platform fee token and the restrictions around who can issue it.

XCHAIN is **separate per chain**. The XCHAIN token on Bitcoin is a completely different asset from XCHAIN on Litecoin or Dogecoin. Holding BTC XCHAIN gives you no LTC XCHAIN, and vice versa. Fee payments on each chain require that chain's XCHAIN token.

## Who Can Issue XCHAIN

The `XCHAIN` ticker is a reserved ticker — no ordinary address can issue a token with that name. Only the designated **GAS address** for each chain and network can issue it. This address is configured per-chain (defined in the indexer's config for each coin and network) and is exempt from the reserved ticker restriction specifically to allow XCHAIN issuance.

This means XCHAIN supply is controlled by the platform deployer, not by any arbitrary address.

## Fee Schedule

Fees are charged in XCHAIN for operations that create or modify persistent state. The specific amounts are configurable per chain and network, but the general categories are:

- **Issuance fee**: Charged to create a new top-level token.
- **Sub-token fee**: A reduced fee for tokens issued under a parent token namespace.
- **DEX listing fees**: Charged for placing orders or opening dispensers.
- **Expiration fees**: Charged per-day for time-limited operations.

Operations that are read-only, or that operate on data already paid for, do not charge fees. Simple token transfers (SEND) between addresses do not require XCHAIN beyond the normal coin miner fee for the underlying blockchain transaction.

## Special Addresses

Each chain and network has four designated addresses with special roles:

| Address | Role |
|---|---|
| `GAS` | Issues the XCHAIN token; receives a portion of fee payments |
| `BURN` | Permanent destruction sink — tokens sent here cannot be recovered |
| `DONATE1` | Optional fee recipient 1 (infrastructure / development) |
| `DONATE2` | Optional fee recipient 2 (infrastructure / development) |

When a fee is collected, it is split and distributed to these addresses according to the fee schedule configuration. The split ratios and amounts are protocol parameters, adjustable per chain.

Sending tokens to the `BURN` address is the standard mechanism for intentional permanent destruction — it works for any token, not just XCHAIN.

## How Fees Are Recorded

Fee payments are full ledger entries. When an ISSUE ACTION charges an issuance fee, the indexer:

1. Validates that the issuer has sufficient available XCHAIN balance
2. Creates a debit entry on the issuer's XCHAIN balance
3. Creates credit entries on the GAS, DONATE1, and DONATE2 balances according to the distribution schedule

All three entries share the same ACTION_INDEX and are committed atomically. If fee validation fails (insufficient XCHAIN balance), the ACTION that triggered the fee is also rejected.

## Acquiring XCHAIN

XCHAIN can be acquired the same way as any other XChain token — through transfers, dispensers, or the order book. The GAS address distributes initial XCHAIN supply, and the secondary market determines availability and price.

---

*See also: [Tokens](./TOKENS.md) | [Ledger](./LEDGER.md) | [Security Model](./SECURITY_MODEL.md)*
