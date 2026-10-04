# Market catalogue redesign — 2026-10-04

Mode: Operate. Extend the approved public visual world; the original reference pins the photo-led hero, pill filters and rounded product cards. White, Forest/Green and Cream, Plus Jakarta Sans. User selected catalogue only, compact photo hero and collapsible inline additional filters. Public detail page stays for the next phase.

Use PublicShell, existing editorial photo and real API data. 24px desktop / 16px phone gutters, no rounded outer page frame. Catalogue grid is 4 columns >=1024px and 2 below1024px, following the user's compact-card refinements. Below640px, catalogue cards show photo, title, offer type, price and location; full descriptions and condition remain in detail. Search submits via Enter/button, category/type/sort apply immediately, additional condition/city/price apply on submit. Applied chips remove individually; reset clears all controls. Preserve initial category query, 20-item cursor pagination and API/DTO contracts. Price sorting only RESELL; switch to EXCHANGE/DONATE clears prices and resets price sort. Additional filters open inline, accessible city selection, early range validation. Skeleton, retry, empty reset, missing image and next-page error recovery must work.

Acceptance: typecheck/lint, bounded desktop/tablet/phone captures at1440/768/390/320; keyboard city selection; category query from Home; all filters, chips, reset and price switching; next-page retry retains items. No data mutation needed to verify.


## Shipped handoff — 2026-10-04

Independent review disposition: Ship, with no material fixes. Catalogue /market now uses PublicShell; detail /market/[id] and dashboards retain classic visuals. DESIGN.md records the current boundary and catalogue-specific roles; the schema2 sidecar reuses the existing MarketCard preview and adds compact hero, pills/inline filters, and loading previews.

Observed hero height: 280px at1440/768, approximately230px at390 and263px at320. Phone CSS minimum200px grows with real copy. Grid3/2/1/1 and gutters24/16 follow the approved contract; initial20 live cards retain demo disclosures. Six detector advisories are intentional catalogue typography/count/empty-state/skeleton roles, rather than changes to baseline tokens.

Evidence: review/market/verification.md, inspection.json, interactions.json, and review.md. Fourteen captures and fourteen frontend scenarios were already reviewed; documentation did not rerun UI checks or produce captures. Typecheck/lint passed in supplied verification. GET fixtures exercise recovery and pagination; this evidence does not claim backend integration or transaction testing.

## Compact card refinement
User confirmed four cards per row on desktop. Catalogue and skeleton grid now use four columns from1024px, two on tablet and one on phone. Earlier three-column captures and review remain historical. New visual observations are in review/market-four-columns: at1440 card width330px, at1024 width226px, no document overflow; tablet/phone preserve2/1 columns. Layout detector reported no findings.

## Two-column phone refinement

The user approved two cards per row with compact content on the catalogue below640px. Current phone rules use a12px grid gap,6px card padding,4:3 photos,14px two-line titles,13px prices and12px location text. Category, condition, description and decorative arrow are hidden only within the catalogue. Filter fields stay in one column, skeletons follow the two-column catalogue, and related cards on detail retain their prior layout.

Frontend inspection with intercepted GET fixtures passed at320/390/430/768/1440px: columns2/2/2/2/4, no document overflow, large prices and long titles/locations, missing and broken images, pagination, offer-type filtering, filter panel columns, detail links and related-card scope. Five grid captures, a phone skeleton capture and measurements are stored locally in .local/mobile-market. This scoped check does not extend earlier independent review verdicts or claim real API integration coverage.
