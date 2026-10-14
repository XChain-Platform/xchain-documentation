<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->

# Wallet UI Style Guide

Use the shared primitives from `@xchain-wallet/core/ui` instead of copying CSS or JSX between routes. The live component catalog is available at `/style-guide/` in development builds. It shows the mobile, extension popup, and desktop frames alongside the supported component states.

## Page layout

Every routed page uses one `Screen` and puts one page template inside it. `Screen.body` owns the only outer page inset:

```css
padding-inline: var(--xc-page-gutter);
padding-block-start: var(--xc-page-top);
```

Do not add another outer horizontal inset in a page template or route. Headers and footers are application chrome, so they manage their own padding.

| Layout tier | Viewport width | `--xc-page-gutter` | `--xc-page-top` |
|---|---:|---:|---:|
| Compact | Below 640px | 12px | 12px |
| Rail | 640px to 899px | 16px | 16px |
| Full | 900px and above | 24px | 16px |

In a short landscape viewport, `--xc-page-top` becomes 8px while the gutter continues to follow the viewport-width tier.

## Layout rules

- Give every form field a visible border in its default state, not only on hover, focus, or error.
- Put Paste, Max, and similar field actions inside the field at its end edge.
- Wrap action rows between whole buttons, never within a button label. Keep every button label on one line.
- Use the shared route-to-section map for both the bottom navigation and desktop sidebar so exactly one section is highlighted for every route.
- Keep the Settings page and all Settings sub-pages at the same content width.
- Fix the extension toolbar popup at exactly 360 by 600 pixels. Keep its chrome fixed and let only the content pane scroll.
- Render sentences in the balance hero as body text. Reserve the amount style for amounts.
- Keep the start and end content insets equal on every surface.

## Network and demo labels

Keep the app header to one row at every width, with the logo on the start edge and action buttons on the end edge.

Do not repeat the active network or coin as text, a chip, a page-top strip, or a toolbar pill. The asset icon and its chain overlay identify the coin and chain. Choose the network in Settings; mainnet is the default. Approval windows may name the chain, but do not name the network kind.

Do not add a page-top demo banner: the header already names the wallet. Explain demo limits inline where an action cannot run. Keep the reachability notice to one line directly below the header.

### Form pages

Use `FormPage` when the page asks the user to enter and submit data. Its presentation depends on viewport width, not the host shell:

- Below 600px, the form is bare and uses only the inset supplied by `Screen`.
- At 600px and above, the form becomes one centered card with a maximum width of 560px.
- `sectioned` divides a long form into named `FormSection` groups. Those groups are heading-separated blocks on narrow screens and separate cards on wide screens.
- `fill` makes the form use the available screen height. Use it when a scrolling child should take the free space or the actions should stay at the bottom.
- `fullWidth` removes the wide-screen card and width limit. Use it for content that must fill the page, such as a reading view.

Put validation or submission feedback in `status` and buttons in `actions`. The action row follows the last field or section and wraps when necessary. Put the primary action last.

### List pages

Use `ListPage` for lists, tables, card grids, and read-only detail rows. It fills the complete content box between the page gutters at every tier. Do not place it in a centered card or give it a route-level maximum width.

Use its `toolbar` for search, filter, and sort controls. The first toolbar control takes the available width, and the remaining controls wrap on narrow screens. Use `EmptyState` when data loads successfully but there is nothing to show.

## Control sizes

Controls share the `sm`, `md`, and `lg` size scale. `md` is the default. Coarse-pointer layouts enlarge controls and preserve a minimum 44px hit area for touch.

| Size | Mouse or precise pointer | Touch or coarse pointer |
|---|---:|---:|
| `sm` | 28px | 36px |
| `md` | 36px | 44px |
| `lg` | 44px | 48px |

The 44px touch hit area is an interaction requirement, not a reason to add route-specific padding. Shared controls provide the target themselves, including transparent hit-area expansion where the painted control remains smaller.

## Vertical rhythm

Use the semantic rhythm tokens so form fields, help text, sections, and list content align consistently.

| Token | Value | Use |
|---|---:|---|
| `--xc-form-gap` | 16px | Between sibling form fields |
| `--xc-label-gap` | 4px | Between a field label and its control |
| `--xc-help-gap` | 4px | Between a control and hint or error text |
| `--xc-section-gap` | 16px | Between form sections or list-page blocks |
| `--xc-section-header-gap` | 8px | Between a section heading and its content |
| `--xc-list-row-padding` | 12px | Inside a list row |

These tokens derive from the wallet's 4px spacing grid. Components own their internal rhythm. Routes should arrange components without reproducing their label, help, row, or section spacing.

## Component kit

| Component | Use it when |
|---|---|
| `Button` | The user performs an action. Use `primary` for the page's main action, `secondary` for another substantive action, `ghost` for cancel or a less prominent action, `danger` for destructive or irreversible work, and `success` to approve a pending request. Use `loading` during an in-flight action and `block` only when the button should fill its container. |
| `Input` | The user enters one line of text, a number, a date, or another value supported by a native input. Supply `label`, and use `hint` or `error` rather than separate route-level text. Use `lg` only for prominent entry fields. |
| `Select` | The user chooses one value from a longer or space-constrained fixed list. It shares the label, hint, error, requirement, and size contract with `Input`. |
| `Textarea` | The user enters multiline content such as a message, description, or payload. It uses the same labeled-field and validation pattern as `Input`. |
| `ListRow` | A list item needs consistent leading, title, subtitle, trailing, and chevron slots. Provide `href` for navigation, `onClick` for a button action, or neither for a display-only row so the component supplies the correct native semantics. |
| `Chip` | Show compact metadata or a lightweight filter. A chip without pressed state is a static label; a chip with `pressed` and `onPressedChange` is a toggle. Do not use a chip for the page's primary action. |
| `Tabs` | Switch among peer panels within the same page or object. Keep the selected value controlled and render the corresponding tab panel with the matching accessibility relationship. |
| `SegmentedControl` | Switch a compact view or mode when all mutually exclusive choices should remain visible. Use it for a small set of short labels, not for navigation between substantial page sections. |
| `Checkbox` | Let the user turn an independent option on or off, or select any number of choices from a group. A checkbox does not imply that selecting one option clears another. |
| `RadioGroup` | Let the user choose exactly one item from a small set whose choices benefit from being visible together. Use `Select` when the list is long or space is limited. |
| `Switch` | Change a boolean setting that takes effect immediately. Use `Checkbox` instead when the value is part of a form that is applied or submitted later. |
| `EmptyState` | A collection loaded successfully and contains no items, including a filter with no matches. Give it a short title, at most one line of explanatory body text, and an optional action that helps populate or recover the view. |

For required fields, use a plain label. Mark optional fields with the component's `optional` prop so it appends `(optional)` and exposes the correct accessibility state. Do not recreate the label, error, focus, disabled, or touch-target behavior in route CSS.

---

**Copyright &copy; 2026 Dankest, LLC**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later).
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
