<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->

# Shell: Watch

XChain Wallet includes an Apple Watch app embedded in the iOS app and a Wear OS app shipped beside the Android app in the same Google Play listing. The phone app prepares the watch data and manages the connection.

## What the watch never does

The watch holds no keys, signs nothing, and approves nothing. A pending request, an open Send confirmation, or a CoinPay payment due shows its sentence, amount, and expiry and offers only **Open on phone**. The watch makes no network requests of its own.

Turning **Show wallet on watch** off sends an empty snapshot. The watch wipes the data it held the next time it contacts the phone.

## How alerts reach the wrist

The phone app posts local notifications. Its operating system forwards them to an Apple Watch or bridges them to a Wear OS watch. There is no push relay and no push service.

Alerts are posted as events arrive while XChain Wallet is running. Deadline alerts are scheduled ahead so the operating system can post them while the app is suspended.

A background check runs a few times a day and posts one **New activity** alert when it finds a change. That alert includes no amount or address. The background check is off while Tor routing is on and can be switched in **Settings > Watch**.

## Auto pay on mobile

Auto pay runs only while XChain Wallet is open on the phone. To keep auto pay running when you are away, leave the XChain Wallet desktop app or browser extension running.

---

**Copyright &copy; 2026 Dankest, LLC**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later).
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
