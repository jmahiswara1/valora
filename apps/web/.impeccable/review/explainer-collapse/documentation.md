# Assessment explainer disclosure

This is an ordinary Operate refinement of the assessment explanation. [PRODUCT.md](../../../PRODUCT.md), [DESIGN.md](../../../DESIGN.md), and the existing [design sidecar](../../design.json) remain the product and visual authority. The [explainer brief](../../briefs/explainer.md) records this surface behavior; [the feature notes](../../../../../docs/30-ai-explainer.md) carry the disclosure update. No new system, tokens, imagery, or assets are introduced.

## Behavior

The source label and explanation summary remain visible. Native details/summary starts closed for the first result, including cached AI and rule-template results. “Lihat penjelasan lengkap” reveals supporting components, limitations, all four action reasons, and next steps; the expanded label is “Ringkas penjelasan”. Notices, disclaimer, loading/error feedback, and retry controls remain outside the disclosure.

The sage summary has a minimum height of 44px, a state-dependent chevron, native keyboard interaction, and the existing focus treatment. The explanation ends with a flat divider before the system “Pilihan tindakan” section. White/forest surfaces, Plus Jakarta Sans, account hierarchy, and readable wrapping follow the incumbent design.

Toggling only changes the native open state; it triggers no inference request or quota use. The details node persists through transient retries for the same assessment and is keyed by assessment id so another assessment starts closed. The existing query, access handling, cooldown, quota, cached-output, and retry behavior are preserved. Score and action eligibility continue to come from the assessment rules.

## Evidence and limits

[Finish review](finish-review.md) records `disposition: ship` with no material fixes. Its evidence covers six full-page captures: [desktop collapsed](desktop-collapsed.png) / [expanded](desktop-expanded.png) at 1440px; [mobile collapsed](mobile-collapsed.png) / [expanded](mobile-expanded.png) at 390px; and [narrow collapsed](narrow-collapsed.png) / [expanded](narrow-expanded.png) at 320px.

[Browser observations](observations.json) record closed initial state, expanded labels, a 44px target, one generation request throughout toggling, no document overflow, and no page errors at all three widths. The browser pass used Enter to open and Space to close. Same-assessment retry persistence and changed-id reset were assessed from the keyed native details implementation; the capture observations do not separately exercise those scenarios.

The builder reported passing typecheck and lint, and one scoped detector run returning `[]`. Existing explainer end-to-end expectations were maintained; no tests were added and the test suite was not run. This documentation pass read the contracts, source, review, and observations and ran no tests or builds.

Browser content uses synthetic fixtures. This refinement changed no backend code and called no live provider; its evidence does not establish provider output quality or backend integration. The ship disposition applies to this disclosure refinement only.
