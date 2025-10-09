# XChain Platform - `ACTION` commands

Below is a list of the defined `ACTION` commands that are supported on the XChain platform and the function of each:

| ACTION                        | Description                                                                                   | 
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| [`ADDRESS`](./ADDRESS.md)     | This action configures address specific options.                                              |
| [`AIRDROP`](./AIRDROP.md)     | This action airdrops `TICK` supply to one or more lists.                                      |
| [`BATCH`](./BATCH.md)         | This action batch executes multiple `ACTION` commands in a single transaction.                |
| [`BROADCAST`](./BROADCAST.md) | This action broadcasts a message, and can also be used to create oracles and betting feeds.   |
| [`CALLBACK`](./CALLBACK.md)   | This action performs a callback on a `TICK`.                                                  |
| [`DESTROY`](./DESTROY.md)     | This action destroys `TICK` supply.                                                           |
| [`DISPENSER`](./DISPENSER.md) | This action creates a dispenser (vending machine) to dispense `TICK` when triggered.          |
| [`DIVIDEND`](./DIVIDEND.md)   | This action pays a dividend to holders of `TICK`.                                             |
| [`FILE`](./FILE.md)           | This action uploads a file including file metadata.                                           |
| [`ISSUE`](./ISSUE.md)         | This action creates or updates a `TICK`.                                                      |
| [`LINK`](./LINK.md)           | This action links actions using `ACTION_INDEX`, including linking actions across blockchains. |
| [`LIST`](./LIST.md)           | This action creates a list of items for use in actions.                                       |
| [`MESSAGE`](./MESSAGE.md)     | This action allows for the sending of plaintext and encrypted messages between addresses.     |
| [`MINT`](./MINT.md)           | This action mints `TICK` supply.                                                              |
| [`ORDER`](./ORDER.md)         | This action creates a order to sell an item on the Decentralized Exchange (DEX).              |
| [`SEND`](./SEND.md)           | This action sends one or more `TICK` to an `ADDRESS`.                                         |
| [`SLEEP`](./SLEEP.md)         | This action pauses actions on `TICK` until `RESUME_BLOCK` is reached.                         |
| [`SWAP`](./SWAP.md)           | This action allows for swapping tokens across XChain platform supported blockchains.          |
| [`SWEEP`](./SWEEP.md)         | This action transfers all `TICK` balances and/or ownerships to an `DESTINATION` address.      |