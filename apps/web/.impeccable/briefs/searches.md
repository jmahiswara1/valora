# Pencarian tersimpan — 2026-10-06

Mode: Operate. Extend the existing public Market and account workspace with a
private saved-search task. Visual authority is the approved white, Forest/Green,
Cream/Sage and Plus Jakarta Sans system in PRODUCT.md, DESIGN.md and the shipped
PublicShell/AccountShell. This is an ordinary feature extension; the existing
normative tokens remain the source for reused controls.

## Approved task and behavior

Save the valid criteria already applied to Market, including searches with no
results. At least one keyword or filter is required; sort alone is insufficient.
Draft text and unapplied filters are excluded. The canonical Market URL remains
the source for applied filters, refresh and Back/Forward. Guests return through
login to the same valid Market query, then choose Save again.

The save dialog shows the criteria, an editable automatic name (1–80 characters),
and a notifications checkbox enabled by default. An active account may keep up
to 10 private searches, including an account with unverified email. Saving
equivalent criteria opens or returns the existing search with its name and alert
setting preserved.

In-app alerts follow a matching listing's first publication after the search was
saved or alerts were enabled. Existing publications, price changes, corrections
and reactivation of the same listing do not generate a new publication alert.
Alerts use the existing Market category in the notification center and bell.
Disabling or deleting a search stops future delivery and preserves notifications
already received. Product and backend details are in docs/26-saved-searches.md.

The basic manager at /app/pencarian supports Lihat hasil, rename, notification
toggle and deletion with confirmation. Criteria changes start from Market.
Sidebar and drawer place the manager in Aktivitas Market. The page explains
privacy, shows the count out of 10 and names alert status explicitly.

## Shipped visual and reusable controls

Reuse AccountHeading, AccountSkeleton, Button, Field, Input and Notice. Keep the
manager as flat white rows with thin Line dividers, a title, wrapping Cream
criteria labels, a text-and-icon alert status and independent actions. At up to
760px each row puts its actions below its content. Lihat hasil retains room for
its label and arrow; the three icon buttons alone have fixed 44px square targets.
Long names and criteria wrap within the row.

Save, rename and delete use SearchDialog: centered White/Forest, maximum width
500px with 16px viewport clearance, radius 20px, padding 28px (20px up to 480px),
and the incumbent flat account backdrop. Height is bounded by the viewport with
internal scrolling. Name fields retain 16px text. Criteria labels are descriptive
list items. The save checkbox has a 44px label target. Primary and secondary pill
actions follow their host surface; deletion uses the existing Danger variant.
The empty manager uses a Cream field and a clear action to Market.

## Accessible and recovery states

The native dialog has a linked title and description, initial focus on the
44px close control, Tab/Shift+Tab containment, Escape dismissal, body scroll lock
and return to the connected opener. After a confirmed removal, focus moves to
the next result link or the page heading. Visible focus uses the shipped Green
outline. Toggle controls include a named action and aria-pressed; status text
explains the active/inactive state independently of color.

Loading, empty, error/retry, disabled, pending and uncertain-response states
retain the existing account patterns. Mutations wait for server confirmation,
disable shared actions while pending and invalidate the account-scoped list for
reconciliation. Success uses role=status; failures use role=alert. Session
identity bounds the cached list and the save dialog. Existing reduced-motion
behavior is inherited from the host surfaces.

## Evidence and finish disposition

Checked finished src/features/searches/{save,list,dialog,criteria,hooks} and
src/styles/searches.css against shared primitives and account/global styles.
Rendered evidence in .impeccable/review/searches/:

- desktop.png and mobile.png: flat manager, long content, criteria/status,
  separate actions and readable Lihat hasil links.
- save-desktop.png and save-mobile.png: centered save dialog, name field,
  selected notifications option, focus and viewport fit.
- delete-desktop.png and delete-mobile.png: centered delete confirmation with
  the existing Danger action and readable cancellation.

Final reviewer disposition: ship. The results-link sizing and destructive delete
variant were resolved in all six final captures. The parent verification record
reports 112 browser regression/feature scenarios, two real API/worker browser
flows, 24 feature confirmations, typecheck/lint and nine API suites passing; the
full record is in docs/26-saved-searches.md. This documentation pass adds no tests.

Context reported no CONTEXT_STALE finding, and the completed detector returned
no findings. No additional drift or defect is canonized or repaired in this
ordinary extension; historical scope notes in DESIGN.md and the sidecar remain
as recorded.
