# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a **documentation-only repository** for the XChain Platform — a blockchain token protocol supporting Bitcoin, Dogecoin, and Litecoin. There are no build, lint, or test commands. All content is Markdown and JSON.

## Repository Structure

- `actions/` — One `.md` file per ACTION command, each following a consistent spec format
- `json/` — Token Information Standard (TIS) JSON schema and example files
- `Token_Information_Standard.md` — TIS spec defining how to associate media with tokens
- `Database_Naming_Structure.md` — Naming convention: `XChain_{CHAIN}_{NETWORK}_{COMPONENT}`

## ACTION Spec Format Convention

Every action file in `actions/` follows this structure:
1. **PARAMS table** — field name, type, description
2. **Formats** — pipe-delimited format strings, one per VERSION number
3. **Examples** — inline code blocks with format string + plain-English explanation
4. **Rules** — validity constraints (invalid transactions are ignored)
5. **Notes** — implementation hints and compatibility aliases

### Key Encoding Conventions

- Fields are separated by `|` (pipe)
- Commands within a `BATCH` are separated by `;` (semicolon)
- `VERSION` is always the first field and determines which subsequent fields are present
- `MEMO` is always the last optional field
- Use `^` prefix when passing a `TICK_ID` instead of a ticker name (e.g., `^1234`)
- `TICK` names cannot contain `|`, `;`, `.`, or `/`; `^` cannot be the first character

### ACTION_INDEX

`ACTION_INDEX` is the cross-reference mechanism used throughout the platform. Many actions reference other actions by their `ACTION_INDEX` (e.g., `ALLOW_LIST`, `BLOCK_LIST`, `DISPENSER_ACTION_INDEX`, `ORDER_ACTION_INDEX`).

## Key Actions Summary

| Action | Purpose | Notable Versions |
|--------|---------|-----------------|
| `ISSUE` | Create/update a token (`TICK`) | v0=create, v1–v5=edit specific param groups |
| `MINT` | Mint supply to broadcasting address | v0 only |
| `SEND` | Transfer tokens | v0=single, v1=multi-brief, v2=multi-full, v3=multi+memos |
| `DISPENSER` | Vending machine for tokens | v0=create, v1=cancel, v2=edit |
| `ORDER` | DEX sell order | v0=create, v1=cancel, v2=edit |
| `BATCH` | Execute multiple actions in one tx | Commands joined with `;` |
| `BROADCAST` | Messages, price oracles, betting feeds | v0=msg, v1=oracle, v2=feed, v3=results |
| `ADDRESS` | Per-address config (fee preference, memo requirements) | v0 only |

## Editing Guidelines

- Maintain consistency with existing PARAMS table formatting (aligned columns)
- When adding a new VERSION to an action, append it to the Formats section with a descriptive subtitle
- `ADDR` is a valid alias for `ADDRESS`; `CAST` for `BROADCAST`; `TRANSFER` for `SEND`; `DEPLOY` for `ISSUE` (backwards compat with BRC20/SRC20)
- All action files begin with the copyright/license header block before the `# XChain Platform Action - NAME` heading
- The `LOCK_RUG` parameter was removed — do not re-add it
