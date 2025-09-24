# XChain Platform - Documentation

This repository is where the documentation the XChain Platform resides

## XChain Components

Below is a list of the various components of the XChain platform and the function of each:

| Component                                          | Description                                                                                    | 
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [`xchain-node`](../xchain-node/)     				 | Federated node which allows users to install, configure, and run XChain platform nodes         |
| [`xchain-encoder`](../xchain-encoder/)             | Encodes XChain `ACTION` commands into blockchain transactions                                  |
| [`xchain-decoder`](../xchain-decoder/)             | Decodes blockchain transactions into XChain `ACTION` commands and populates a decoder database |
| [`xchain-indexer`](../xchain-indexer/)     		 | Indexes XChain `ACTION` commands from decoder database to determine status of each transaction |
| [`xchain-explorer`](../xchain-explorer/)    		 | Blockchain Explorer and APIs that provide access to the XChain platform data                   |
| [`xchain-hub`](../xchain-hub/)     				 | Oracle for COIN pricing information and cross-chain actions which are synced out to nodes      |
| [`xchain-utxo-tracker`](../xchain-utxo-tracker/)   | Tracks blockchain Unspent Transaction Outputs (UTXOs) and provides APIs to retrieve UTXO data  |
| [`xchain-regtest-miner`](../xchain-regtest-miner/) | Miner that handles processing transactions into blocks for regtest networks as needed          |
| [`xchain-e2e-test`](../xchain-e2e-test/)     		 | Testing suite for XChain platform components to ensure data integrity                          |


## XChain `ACTION` commands

Below is a list of the defined `ACTION` commands that are supported on the XChain platform and the function of each:

| ACTION                                | Description                                                                                   | 
| ------------------------------------- | --------------------------------------------------------------------------------------------- |
| [`ADDRESS`](./actions/ADDRESS.md)     | This action configures address specific options.                                              |
| [`AIRDROP`](./actions/AIRDROP.md)     | This action airdrops `TICK` supply to one or more lists.                                      |
| [`BATCH`](./actions/BATCH.md)         | This action batch executes multiple `ACTION` commands in a single transaction.                |
| [`BROADCAST`](./actions/BROADCAST.md) | This action broadcasts a message, and can also be used to create oracles and betting feeds.   |
| [`CALLBACK`](./actions/CALLBACK.md)   | This action performs a callback on a `TICK`.                                                  |
| [`DESTROY`](./actions/DESTROY.md)     | This action destroys `TICK` supply.                                                           |
| [`DISPENSER`](./actions/DISPENSER.md) | This action creates a dispenser (vending machine) to dispense `TICK` when triggered.          |
| [`DIVIDEND`](./actions/DIVIDEND.md)   | This action pays a dividend to holders of `TICK`.                                             |
| [`FILE`](./actions/FILE.md)           | This action uploads a file including file metadata.                                           |
| [`ISSUE`](./actions/ISSUE.md)         | This action creates or updates a `TICK`.                                                      |
| [`LINK`](./actions/LINK.md)           | This action links actions using `ACTION_INDEX`, including linking actions across blockchains. |
| [`LIST`](./actions/LIST.md)           | This action creates a list of items for use in actions.                                       |
| [`MESSAGE`](./actions/MESSAGE.md)     | This action allows for the sending of plaintext and encrypted messages between addresses.     |
| [`MINT`](./actions/MINT.md)           | This action mints `TICK` supply.                                                              |
| [`ORDER`](./actions/ORDER.md)         | This action creates a order to sell an item on the Decentralized Exchange (DEX).              |
| [`SEND`](./actions/SEND.md)           | This action sends one or more `TICK` to an `ADDRESS`.                                         |
| [`SLEEP`](./actions/SLEEP.md)         | This action pauses actions on `TICK` until `RESUME_BLOCK` is reached.                         |
| [`SWAP`](./actions/SWAP.md)           | This action allows for swapping tokens across XChain platform supported blockchains.          |
| [`SWEEP`](./actions/SWEEP.md)         | This action transfers all `TICK` balances and/or ownerships to an `DESTINATION` address.      |

This document is placed in the public domain.