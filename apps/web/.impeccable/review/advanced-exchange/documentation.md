# Exchange documentation handoff

Date: 2026-10-14. Mode: Operate. Scope: ordinary extension of Market offer creation, account offers and transaction details within the incumbent Valora system.

## Authority and preserved system

Reviewed `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, `.impeccable/briefs/advanced-exchange.md` and the Impeccable documentation reference. The existing Plus Jakarta Sans, white/forest/cream/sage palette, native controls, pill actions, rounded account panels, flat dividers and shell hierarchy remain authoritative. This handoff records the shipped extension in the surface brief; it adds no global tokens or visual-world decisions.

PRODUCT.md, DESIGN.md and `.impeccable/design.json` were preserved. The sidecar remains schema version 2 with its existing generation timestamp; it was not regenerated as a side effect of this extension.

## Source inspected

- `src/features/exchange/picker.tsx`, `cash.tsx`, `terms.tsx`, `counter.tsx`, `history.tsx`, `settlement.tsx`.
- `src/features/market/detail.tsx`, `src/features/offers/list.tsx`, `src/features/transactions/detail.tsx`.
- `src/styles/exchange.css`, `src/components/ui/confirm-dialog.tsx`.

The picker caps each actor's bundle at three, displays minimum/maximum guidance, retains selected snapshots, locks the owner's Listing anchor, explains unavailable candidates and supports cursor pagination/retry. Initial Market offers include the Listing owner's item and the bidder's selection; counteroffers edit the responder's own bundle and optional cash while retaining the other bundle. Frozen draft versions block stale submissions. Accepted reviews display captured terms and submit the captured offer/listing revisions, expected version and terms hash.

The required native-dialog checkbox gates acceptance and cash reports. The dialog focuses its heading on open and restores the triggering focus on close. Exchange terms use two plain columns, stack at 600px, and stack inside confirmation dialogs. Compact photos, wrapping item text, native disclosure controls and dividers follow the incumbent account patterns.

Transaction details use frozen item snapshots and one handover plus one receipt report per item. Optional cash uses separate payer SENT and receiver RECEIVED reports, with participant names, amount and direction. Copy explains that these are user reports of direct payment and that ownership waits for the required item and cash confirmations. Cash actions are limited to active handover statuses, held during disputes, and replaced by direct refund-coordination copy on cancellation. Admin resolution carries an explicit notice that it is not payment evidence. Valora provides no escrow or bank verification in this flow.

## Captures inspected

All 17 PNGs were reopened during this handoff. They cover the supplied 1440px desktop, 390px phone and 320px narrow-phone views, plus settlement crops.

| Surface | Capture files |
| --- | --- |
| Incumbent | `incumbent.png` |
| Market offer creation | `market-desktop.png`, `market-mobile.png` |
| Both offer bundles | `desktop.png`, `mobile.png`, `user-320.png` |
| Owner counteroffer and eligibility | `counter-desktop.png`, `counter-mobile.png` |
| Frozen acceptance and consent | `accept-desktop.png`, `accept-320.png`, `accept-consent-320.png` |
| Revision history | `history-desktop.png` |
| Frozen transaction and item reports | `transaction-desktop.png` |
| Cash acknowledgement, waiting, complete and cancelled | `cash-mobile.png`, `cash-pending-mobile.png`, `cash-completed.png`, `cash-cancelled-mobile.png` |

The inspected captures show readable wrapped item rows, the desktop-to-phone bundle stack, OWNER and BIDDER cash directions, the mandatory anchor/max-selection explanation, and a scrollable acceptance dialog whose consent/actions remain reachable at 320px. Loading/empty/retry, stale revisions, disputes and admin-resolution notices were checked in source where there is no dedicated capture. These are visual and source observations; the handoff does not independently verify API races, live payment or ownership transitions.

## Review and detector

The fresh finish reviewer returned disposition **ship**, with no material fixes and preservation of the existing system. The completed single detector run is retained at `detector.json`, containing `[]`. Documentation did not rerun the detector, take additional screenshots or perform UI edits.

## Existing drift

DESIGN.md describes chat list panes of 285px and 240px; the current `src/styles/chat.css` implements 300px and 260px. The incumbent chat composer is intrinsically sized within flex layout and uses static positioning. This is unrelated existing documentation drift and was preserved without repair. No Exchange-specific conflict requiring a new system definition was identified.

Persisted artifacts: the Evidence section of `.impeccable/briefs/advanced-exchange.md` and this documentation handoff.
