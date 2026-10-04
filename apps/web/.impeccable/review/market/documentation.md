# Catalogue documentation handoff — 2026-10-04

Targeted merge authorized by the approved catalogue plan. Changed DESIGN.md, .impeccable/design.json, and .impeccable/briefs/market.md, plus this handoff. PublicShell boundary now includes /market; detail and dashboards remain classic. Historical earlier-stage review evidence is retained with its original scope. Baseline palette, typography families, layout identity, and unrelated entries are preserved.

Source: PRODUCT.md, market brief, shipped market-catalog.tsx/market.css/market page, shared MarketCard/PublicShell, and supplied verification/inspection/interactions/review. Independent review disposition Ship has no material fixes. No UI source edits, screenshots, or additional implementation checks performed.

Catalogue role additions record intentional hero/title/count/empty-state typography and skeleton-line radius. Sidecar schema2 remains extension-only, with role metadata and three standalone HTML/CSS examples; the existing card preview is reused. Hero example intentionally uses the forest fallback without a photograph; runtime retains the existing editorial photo. Filter example shows the expanded layout; query and city keyboard behavior remain runtime responsibilities.

Pre-existing drift retained: the sidecar already has component references such as radius-card and surface-ink that do not resolve to current component frontmatter keys; the generic Typography title description and public button/hero guidance do not describe every local variant. These unrelated entries were not corrected. The current catalogue boundary in narrative is synchronized, including the current three-link shared navigation.

Validation: Written DESIGN.md YAML frontmatter parsed successfully with installed js-yaml; .impeccable/design.json parsed successfully with JSON.parse and retains schemaVersion2. All three new examples contain standalone HTML/CSS. No UI checks were rerun. Git diff was unavailable because the supplied workspace is not a Git checkout.
