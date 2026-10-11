# Analisis foto barang

Mode: Operate. Ordinary extension of the existing AccountShell item form.

## Direction contract

- Preserve the white, forest, sage and cream palette, Plus Jakarta Sans, flat sections and native form controls.
- Put photos first. Select one to three photos, explain that selected photos are sent to AI, and generate only on an explicit action.
- Keep one inline result, with an always-visible summary and per-field current/proposed values. Empty fields may be preselected; populated or manually edited fields require explicit selection. Category and subcategory are one choice.
- Apply selected suggestions to the form without saving. Keep detailed observations and requested photos in native disclosures. Do not claim physical verification, function, safety, price or a new Score.
- Preserve manual entry through pending/unavailable states. Invalidate results after photo selection changes, item version changes, save and session changes.
- No new visual world or assets. Desktop, 390px and 320px must retain readable suggestions, visible focus and 44px choice targets without horizontal scrolling.

## Evidence

Incumbent: `.impeccable/review/photo-analysis/incumbent.png`. Captures and finish review belong in that directory. PRODUCT.md, DESIGN.md and source remain the visual authority. No approved comp is required for this ordinary extension.

## Finish documentation — 2026-10-11

Disposition from the finish reviewer: **ship**, with no material fixes required in the supplied evidence. This is an ordinary Operate extension of `/app/barang/baru` and `/app/barang/[id]/edit`; it establishes no new visual world or system tokens. `PRODUCT.md`, `DESIGN.md` and `.impeccable/design.json` are preserved.

The documentation comparison checked those three authority files, the direction contract, `docs/31-ai-photo-analysis.md`, `src/features/items/{form,photo-analysis,use-photo-analysis,uploads}.tsx/ts`, and the photo-analysis additions in `src/styles/account.css`. It also opened the incumbent, finished desktop and 320px captures and read the recorded manual observations. The remaining required captures were inspected by the build and finish review; documentation does not claim a new browser or test pass.

### Consistency with the incumbent

- Plus Jakarta Sans and the existing task hierarchy remain: account section headings, subsection headings, body copy, smaller helper labels and existing Button/Notice/Field/Select components. White, Forest/Green, Muted, Cream and Soft Sage retain their existing roles; separators use Surface Line.
- The existing 900px form, section spacing, 16px section radius, 10px photo preview radius, 12px disclosure radius and pill actions remain recognizable in the incumbent/finished comparison. Suggestions use flat divided rows, without additional cards, shadows or decorative motion. The local 4px outline radius is only a keyboard focus treatment, not a new surface primitive.
- Photo and suggestion choices have labelled native checkboxes with 44px targets. Native `details` keeps observations and requested photos behind one disclosure. Desktop current/proposed values sit side by side; the existing 600px account phone breakpoint stacks them and wraps the analysis action. The 390px and 320px evidence records no horizontal overflow.
- Photos precede manual fields; an explicit action sends the selected one to three photos to AI. The inline summary remains visible, category/subcategory form one selection, and `Terapkan pilihan` updates the form without saving. Existing populated/manual values require selection; manual edits deselect their suggestion. Pending and unavailable states retain manual entry, and retry respects the shown cooldown.

### Evidence and limits

Required reviewed captures, all under `.impeccable/review/photo-analysis/`: `incumbent.png`, `desktop-empty.png`, `desktop.png`, `mobile.png`, `user-320.png`, `details.png`, `desktop-edit.png`, `mobile-pending.png`, `mobile-unavailable.png` and `mobile-needs-photos.png`. `live-api.png` is supplemental endpoint evidence and was not required for the finish verdict.

`observations.json` records the bounded manual checks: 1440px/390px/320px, 44px choices, manual edits including edits while pending, atomic category application, apply without save, upload-ticket reuse on save, disclosure without AI requests, result clearing after photo changes, prior-result retention on temporary unavailability, retry cooldown and no apply action for an empty `NEEDS_PHOTOS` result. These are recorded browser observations, not an automated regression suite. Broader untested service/race scenarios remain listed in `docs/31-ai-photo-analysis.md`.

State captures reuse the existing `care-chair` asset and mocked responses to inspect UI behavior. They do not certify an individual item's physical condition or every provider response. No shipping raster was generated for this extension. The one detector pass reported the local preview's static missing `src`; the inline exception explains effect-assigned object URLs and cleanup, and loaded previews were verified in the captured browser states. No second detector pass was performed.

### Pre-existing drift outside this extension

The incumbent design artifacts still describe the message pane as 285px/240px and the composer as sticky. The current chat brief and `src/styles/chat.css` instead record 300px/260px panes and an intrinsic footer with independent history/list scrolling. The sidecar's account breakpoint descriptions also retain the older message-pane wording. This discrepancy belongs to the existing chat work and is recorded without repairing or regenerating the design artifacts. No additional material drift was identified within the item-form comparison.
