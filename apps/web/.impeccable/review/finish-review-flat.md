disposition: ship

Scope: first verdict pass scoring only the one material fix listed in the fresh full review preserved at [finish-review-initial.md](flat-layout/finish-review-initial.md). This ship disposition covers that scored fix and the preservation checks associated with its batch; it does not represent a new whole-surface review.

## persistence

Pass for this correction. The source adds only the local rule `.how-steps p, .how-steps small, .passport-explanation p { max-width: 70ch; }`. The page container remains `max-width: none`. The supplied documentation handoff records the same prose rule in DESIGN.md, the sidecar, and the design-system notes while preserving the canvas rule and component previews.

All 16 overwritten required captures were opened once: the four Cara Kerja full pages, the eight Home/Impact full pages, and the four Home first-viewports. Every capture is valid, shows the named route and declared scope from the document top, and contains settled images/content. No recapture is owed. Final inspection.json records validCanvas, exact 24/16px gutters, HTTP 200, and no runtime errors, broken images, or document overflow for all 12 route/viewport combinations. The supplied verification records the repeated successful 45-route production build and 20 browser cases; the reviewer did not rerun them.

## fidelity

| Listed fix | Verdict | Evidence |
| --- | --- | --- |
| Fix 1: constrain Cara Kerja process paragraphs, notes, and Passport prose to a local 65–75ch measure while preserving the approved canvas and responsive columns | resolved | The source uses 70ch for all three selectors. how-wide.png visibly shortens the process lines and Passport paragraphs without centering them or narrowing the page. inspection.json reports wide-screen widths of 760.19px for step paragraphs, 658.83px for notes, and 709.52px for Passport paragraphs, each matching its font's local 70ch maximum. Desktop/tablet/mobile captures retain readable wrapping inside their existing columns. |

No regressions introduced by this CSS batch are visible in the supplied preservation evidence. The white canvas still reaches the viewport edges; header/main/footer retain their approved alignment, internal photos/cards retain their geometry, and Home's grid and both first-viewport hero actions are preserved.

## ceiling

Reached for the one scored correction: the previously open instructional prose measure now falls within the craft floor's 65–75ch range. The prior full review remains the baseline for all other promises.

## material_fixes

Clear. The sole listed material fix is resolved, with no partial or unresolved item remaining from that list and no observed regression from its batch. No further correction round is owed by this verdict.

## keep

Preserve the local 70ch prose limit, viewport-wide white canvas, exact 24/16px gutters, responsive columns, photographic hierarchy, internal rounding, forest/cream palette, visible actions, real data/disclosures, and approved phase 1 scope.
