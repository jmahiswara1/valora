# Assessment AI Explainer documentation

Recorded 2026-10-07. This is an ordinary Operate extension of the existing assessment result page. The [surface brief](../../briefs/explainer.md), [PRODUCT.md](../../../PRODUCT.md), [DESIGN.md](../../../DESIGN.md), and [design sidecar](../../design.json) remain the authority. This pass records the finished surface; it creates no world, token, component primitive, approved comp, or FORM seed. The three authority files and the brief were preserved.

## Sources checked

The [explanation component](../../../src/features/assessments/explanation.tsx), its placement in [AssessmentResult](../../../src/features/assessments/result.tsx), the final explanation selectors in [account.css](../../../src/styles/account.css), the inherited assessment and primitive rules in [globals.css](../../../src/styles/globals.css), [Button and Notice](../../../src/components/ui/primitives.tsx), application font imports, and the request timeout option in [api.ts](../../../src/lib/api.ts) were checked. The Explainer follows the assessment components and any missing-data section, then precedes the existing action choices and source context.

All three final captures were opened: [desktop](desktop.png), [mobile](mobile.png), and [narrow](narrow.png). The [finish review](finish-review.md) gives `ship` for the sole scored correction: generated prose measure. Its verdict does not constitute a backend security review or a review of unrelated surfaces.

## Inherited system

| Rule or role | Evidence in this surface |
| --- | --- |
| Surface Rule | White account canvas with Forest text; supporting notices use Soft Sage, warning badges use the recorded account warning pair, and errors use Error Surface. Forest, Green, Sage, Cream, Muted, Line, and Surface Line retain their existing values and roles. |
| One Family Rule | Application imports Plus Jakarta Sans at 500/600/700. Explanation body inherits 16px/500 with line-height 1.5. Its assessment h3 inherits 17px/700, line-height 1.4, and tracking -0.02em. Subheadings use the existing body size and heading weight. |
| Existing controls | Secondary Button remains a native button: White/Forest, Line border, Sage hover, 100px pill radius, 44px minimum height, 14px/600 text, 11px 18px padding, wrapping label, and disabled opacity 0.55. |
| Existing state components | Notice uses 14px text, line-height 1.6, 12px radius, and 14px 16px padding. Action badges retain 12px/600 text, line-height 1.45, 100px radius, and 6px 11px padding. Metadata retains the account 13px scale. |
| Flat Surface Rule | The explanation uses the existing flat assessment section, spacing, thin dividers, and an 18px form-stack gap. It introduces no shadow, nested panel, illustration, or additional motion. Green keyboard outlines and reduced-motion behavior remain inherited. |

These are applications of established primitives. The full account layout, public hero hierarchy, and other shell styles have not been redefined by this extension.

## Feature-local layout

The final scoped rule limits introductory paragraphs, the generated summary, and every explanation list item to `72ch`. This includes strengths, limitations, action reasons, and next steps. The maximum is local to the Explainer and is not a new global typography or spacing token. Existing 70ch public reading rules and 68ch account recommendation rules keep their own contexts.

The source/cache row and each action term allow wrapping with gaps of 8px vertically and 16px horizontally. Four reason rows use definition-list terms and descriptions, 16px vertical padding, and full-width 1px Line dividers. Only prose is capped; the section and divider widths remain available across the account content area. Reason list items use `overflow-wrap: anywhere`.

The inherited sidebar and toolbar behavior, 24px desktop content gutters, and 16px phone gutters continue to apply. The 1440px capture shows the generated summary wrapping within its new measure. The 390px and 320px captures show readable source labels, all four action names and status labels, reasons, limits, next steps, and metadata without visible clipping. The 320px fixture includes historical and partial assessment data: Resell says `Perlu data` both in the explanation and in the original assessment choices. These are full-page images from 1440×900, 390×844, and 320×760 viewports; their image dimensions are respectively 1440×2254, 390×3040, and 320×3956.

## States and semantics

| State | Implemented behavior |
| --- | --- |
| Initial/manual | The query is disabled by default. `Jelaskan hasil penilaian` explicitly performs the POST request. Automatic query retries and refetch on focus/reconnect are disabled. |
| Loading | The section is labelled by its h3 and sets `aria-busy`. The pending control is disabled with an Indonesian loading label; separate loading copy has `role="status"` and explains the wait. This endpoint requests a 75-second timeout through the shared API option. |
| Source/cache | The result explicitly says `Penjelasan AI` or `Penjelasan dari rubrik`, and cached results add `Hasil tersimpan`. Summary, supporting components, limits, four action reasons, next steps, and the physical-inspection/price disclaimer remain readable. |
| Fallback | Disabled, unconfigured, quota, busy, timeout, unavailable, and invalid-output responses have specific copy while retaining the rule explanation. Disabled or unconfigured responses do not ordinarily offer an AI retry. |
| Cooldown/quota | `retryAt` controls the disabled retry and its label. Daily user/platform quota recovery is formatted with `Asia/Jakarta` and explicitly labelled WIB. The cooldown clock updates once per second when a retry time exists. |
| Historical/partial | A historical explanation shows its own notice. Existing assessment missing-data guidance stays ahead of the Explainer, and the action statuses retain the contract's eligibility labels. |
| Transient failure | Previously returned data remains visible and the error says the previous result is still available. Notice error semantics use `role="alert"`; a manual retry is available when permitted. |
| Denied/changed | Responses with 401/403/404, `SESSION_CHANGED`, or `STATE_CONFLICT` hide prior explanation content. A state conflict supplies `Muat ulang penilaian`. |
| Expired data | When the returned expiry is evaluated as past, an AI result offers `Perbarui penjelasan`. Expiry does not itself dispatch a request. |
| Safe prose | Explanation strings are React text children. There is no HTML or Markdown rendering path. Four action labels and three status labels come from the local contract mapping; badges communicate status through text. |

## Recorded execution evidence and limits

The existing [focused browser log](../../../../../.local/explainer-browser.log) reports 16 passes. The [API log](../../../../../.local/explainer-api.log) reports 28 unit checks and 13 smoke suites passing, including the Explainer's access, CSRF, quota/WIB, cooldown, timeout, cache, concurrency, and race cases. The completed [browser regression log](../../../../../.local/explainer-regression.log) reports 202 passes. These logs were read; no tests were rerun in this documentation pass. Root records the final verification summary separately.

The existing [detector result](../../../../../.local/explainer-detector.json) is `[]`; the detector ran once and was not rerun here. Browser captures and focused scenarios use explicit synthetic fixtures. The supplied real-provider check used local9router and exactly `ag/gemini-3.8-flash-high` with synthetic structured facts; the [recorded result](../../../../../.local/explainer-live-result.json) has `source: AI`, four validated action entries, and no fallback. It is execution evidence for that configured provider check, not a claim about arbitrary future provider wording or availability.

## Drift preserved

The incumbent Overview and sidecar retain the historical 21-entrypoint account migration description; the current source tree has 25 non-admin account `page.tsx` files. The sidecar also retains `generatedAt: 2026-10-04T09:07:45.177Z` while carrying later saved-search context. These historical metadata differences were not repaired because this task authorizes an ordinary surface extension, not a global documentation refresh. No craft-floor defect or feature-local 72ch measure was canonized as a reusable system rule, and no token mismatch was found in the checked Explainer surface.
