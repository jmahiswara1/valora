# Exchange lanjutan

Mode: Operate. Ordinary extension of the existing Market and AccountShell.

## Direction contract

- Preserve Plus Jakarta Sans, white/forest/cream/sage, native controls, existing task hierarchy and flat dividers.
- Each side offers 1–3 items, with the Listing item pinned in the owner's bundle. Both bundles and the optional cash direction/amount must be readable before acceptance.
- Offer creation, alternate counteroffers and final acceptance are separate actions. Counteroffers edit only the actor's own items and cash; frozen revisions protect drafts and acceptance against live updates.
- Use compact photo rows and two plain bundle columns, stacked on phones. No nested cards, new artwork, gradients, or decorative shadows.
- Show cash confirmations as user reports; no checkout or bank verification. Completion waits for each item's handover/receipt and both cash reports when needed.
- Cover pending/empty/error, unavailable item reasons, pagination, max selection, immutable anchor, offer history, confirmation dialogs and 1440/390/320px without overflow.

## Evidence

Documentation handoff completed on 2026-10-14 against the finished source and all 17 PNGs in `.impeccable/review/advanced-exchange/` (one incumbent capture and 16 feature captures, covering 1440/390/320px views and settlement crops). PRODUCT.md, DESIGN.md, `.impeccable/design.json` and the incumbent source remain the visual authority. The extension preserves the existing visual system.

- Market creation: `market-desktop.png` and `market-mobile.png` show the existing PublicShell, item picker, initial zero selection, optional cash control, and disabled submit until an item is selected.
- Offer terms: `desktop.png`, `mobile.png` and `user-320.png` show three items per side, photos, condition text, optional item stories, cash amount/direction, and separate acceptance/counteroffer actions. The two bundle columns stack on phones.
- Counteroffers: `counter-desktop.png` and `counter-mobile.png` show the actor's own 3/3 selection, locked Listing anchor, eligibility reasons, pagination, maximum-selection explanation and OWNER cash direction. Source retains the other party's bundle and freezes the revision/version used by the draft; a changed offer blocks submission until the draft is reopened.
- Acceptance/history: `accept-desktop.png`, `accept-320.png` and `accept-consent-320.png` show a viewport-bounded native dialog with the full frozen terms, reservation/completion explanation and required review checkbox. `history-desktop.png` shows revision snapshots and item-change counts. Acceptance submits the captured revision, version and terms hash.
- Transaction/settlement: `transaction-desktop.png` shows the immutable transaction items and per-item handover/receipt reports. `cash-mobile.png`, `cash-pending-mobile.png`, `cash-completed.png` and `cash-cancelled-mobile.png` cover the cash acknowledgement dialog, one-report wait, both reports and direct refund coordination after cancellation. OWNER and BIDDER cash directions appear in the captures; payment remains direct between users, with no escrow or bank verification.
- Source inspection also covers picker/history loading, empty, retry and pagination states; preserved selection snapshots; pending/stale controls; cash actions held during disputes; and the notice distinguishing admin resolution from payment evidence. These states are source evidence where the capture set does not show them. Screenshot inspection supports layout/copy and does not independently establish backend concurrency or ownership behavior.
- The fresh finish reviewer returned **ship**, with no material fixes and preservation of the current system. The completed detector ran once and `.impeccable/review/advanced-exchange/detector.json` contains `[]`; it was not rerun for documentation.

Pre-existing unrelated drift is reported without repair: DESIGN.md describes chat list panes of 285/240px, while `src/styles/chat.css` implements 300/260px. The incumbent chat composer uses intrinsic flex sizing and static positioning. This Exchange handoff does not refresh PRODUCT.md, DESIGN.md or `.impeccable/design.json`. Detailed source and scope notes: `.impeccable/review/advanced-exchange/documentation.md`.
