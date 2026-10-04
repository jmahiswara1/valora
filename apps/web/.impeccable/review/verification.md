# Public redesign phase 1 — verification

Date: 2026-10-03. Scope: Home, Cara Kerja, public Impact, shared public components, and category navigation into the existing Market.

## Code checks

Commands from the workspace root:

```powershell
pnpm --filter @valora/web run typecheck
pnpm --filter @valora/web run lint
$env:NEXT_BUILD_DIRECTORY = '.next-public-build'
pnpm --filter @valora/web run build
```

All completed successfully. The production build used a separate output directory from the user's existing development server. Next's generated tsconfig includes and next-env.d.ts were restored to their pre-build contents, confirmed by matching SHA-256 hashes.

## Browser scenarios

Five scenarios in `tests/public-ui.spec.mjs`, run at 1440×1000, 768×1024, and 390×844:

1. Category selection is retained in the Market URL/filter and the card opens the matching detail; guest recording action points to registration.
2. Resell, Donate, and Exchange labels/prices, long titles, absent/broken photographs, and document width.
3. Category and listing API failures, retry recovery, and empty/reset states.
4. Five public Impact metrics, unavailable values, large rupiah amounts, period selection, and source notes.
5. Authenticated recording action, keyboard skip link, mobile menu Escape, and restored focus.

The first matrix run passed 14 cases. The mobile broken-photo case initially expected a lazy image to fail before it was scrolled into view. The test was corrected to scroll to that card, and its targeted rerun passed. All 15 cases have passed across the matrix and rerun; no product change was required for that test adjustment.

The local runner configuration is `.local/redesign-phase1/playwright.config.mjs` at the workspace root. It uses the existing development server and mocked API responses, with no account or database mutations. Reproduce locally:

```powershell
pnpm --filter @valora/web run test:e2e --config ../../.local/redesign-phase1/playwright.config.mjs
```

## Visual evidence

The isolated production preview provided clean captures for the three public routes at all three widths. `production-inspection.json` records HTTP 200, no JavaScript errors, no broken images, no horizontal document overflow, and both Home hero actions in the initial viewport. Every full-page and first-viewport capture was opened before review. The temporary production preview was stopped; the user's development server remains available.

The independent finish review returned **ship**, with no material fixes, for the supplied phase 1 screenshots and source. Its evidence and limits are recorded in `finish-review.md`.

The Impeccable detector ran once on the changed public targets and returned `[]`. Provenance scan reported three shipping editorial raster assets and zero missing prompts/origins. Generation/source details are in `../asset-prompts.md`.
