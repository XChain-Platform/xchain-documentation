# Upgrade Notice Policy

**Status:** adopted 2026-07-07 (flag-day inventory Decision 4)

Every consensus activation value (the flag-day maps in [`constants.js`](constants.js) and the
`protocol_changes.js` timestamp gates) ships in a tagged release before it fires. This policy
sets the minimum lead time between that release and the earliest activation moment it arms.

## Minimum lead time

| Phase | Minimum notice | Applies |
|---|---|---|
| Pre-launch (every validator is operator-run) | **14 days** | now |
| Post-launch (any third-party validator live) | **60 days** | from the first external validator onward |

The clock starts when the release carrying the new activation values is tagged and its
announcement is published; it ends at the earliest activation moment in the release
(first chain to cross an armed height, or the armed timestamp).

## Rules

1. An activation value may be **deferred** (moved later) at any time before it is crossed by
   shipping a new release; deferral resets the notice clock only for the moved value.
2. An activation value must NEVER be moved **earlier** than the minimum notice allows.
3. After a value is crossed, reverting it is itself a consensus change and requires a new
   flag-day under the same notice rules.
4. Emergency security fixes that must activate faster than the minimum notice require
   explicit coordination with every known validator operator; silence is not consent.

## Why

Cohort A/B gates change action validity, ledger hashes, or signature preimages; a validator
that misses an upgrade forks (Cohort A/B) or halts (Cohort C) at the boundary. The notice
window is what makes "the whole fleet flips together" achievable for operators who do not
watch the repositories daily.
