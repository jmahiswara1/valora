# Profil publik dan ulasan — 2026-10-06

Mode: Operate. Ordinary extension of the approved Valora white, Forest/Green,
Cream/Sage, Plus Jakarta Sans system. Reuse PublicShell, AccountShell, MarketGrid,
ProfileAvatar and existing form, dialog and critical-action controls.

## Approved task and behavior

Every ACTIVE account has /profil/[id], with its name, city, join month/year,
optional public photo, average rating/count and Barang/Ulasan URL tabs. Barang is
the default. Active listings retain four desktop and two mobile columns. Public
responses exclude email, addresses, transaction IDs, price agreements, private
item history, messages and evidence. Unavailable accounts receive a 404 state.

Review creation requires verified email and a completed, uncorrected transaction.
The buyer/recipient reviews the seller/donor for Resell/Donate; both participants
can review each other for Exchange. Integer rating 1–5 is mandatory; a trimmed
comment up to 1,000 characters is optional. The deadline is 30×24 hours after
completion. A review publishes immediately and is immutable, with one review per
transaction/author. An open/in-review/blocked correction prevents a new review;
an actual reversal removes existing reviews from public display and rating.

The reviewed person may send one immutable reply up to 1,000 characters. A
verified user may report another user's review or reply. Admin moderation uses
assigned reports, scoped five-minute access, reasons, version guards and audit.
Hidden reviews leave rating calculations; hiding replies preserves rating.

Public photos are opt-in, off by default. A controlled public image route checks
active status and the current preference on every request. Own account/chat photo
access remains private. Review and reply notifications use the existing private
transaction category and destination, with atomic, deduplicated writes.

## Direction contract

THESIS: let people evaluate a trading partner through their currently offered
items and completed transaction experiences in one readable public profile.

OWN-WORLD: keep the existing white workspace, forest text, green actions and small
cream reply fields, with Plus Jakarta Sans and flat separators.

STRUCTURE: a compact identity and rating header leads into two URL-addressable
tabs. Listing photography uses the existing catalog; reviews read as flat rows.

FIRST VIEWPORT: expose the person's name, location, join date, rating and active
tab before the listings or review text. Mobile wraps rating below identity and
keeps two listing columns.

SIGNATURE INTERACTION: select a rating through five native 48px radio targets;
selection fills the chosen range and announces the numeric value. Publication
waits for the server and supports recovery of an uncertain response.

MOTION AND STATES: retain the incumbent focus and reduced-motion rules. Loading,
empty, unavailable, retry, pending, disabled and committed states are explicit;
centered report dialogs contain focus and restore it to the opener.

## Implementation and evidence

Source: src/features/profile/public.tsx and public-settings.tsx,
src/features/profile/avatar.tsx, src/features/reviews/{entry,transaction}.tsx,
src/features/market/owner.tsx, src/features/admin/reports/detail.tsx,
src/styles/reviews.css and the scoped compact catalog rules in
src/styles/market.css. Product/API behavior is recorded in
[the feature record](../../../../docs/27-public-profiles-reviews.md).

## Finished component application — 2026-10-06

The public profile uses the existing PublicShell white canvas, sticky navbar,
24px desktop and 16px phone gutters, with no outer page enclosure. Its identity
header combines the shared circular avatar, name, city and join month/year with
a rating or explicit no-review state. The profile avatar is 96px on desktop and
72px through 767px; the name uses a local 30–44px title and 28px phone title.
Through 767px the rating moves below identity. Barang/Ulasan are URL links with
aria-current, a 52px minimum target and an underline for the active tab.

Barang reuses MarketGrid and MarketCard: four columns from 1024px and two below.
Through 639px the compact catalog rules apply to both Market and public profiles:
6px card inset, 4:3 photos, title, offer type, price/target and city remain visible.
The rules retain the separate layout of related items on listing detail.

Ulasan uses flat rows, a maximum 900px reading area, author-profile links, dated
metadata, Green stars and the transaction type. Comments and replies render as
plain text, preserve line breaks and wrap long content. A missing comment has an
explicit label. The small reply field uses Cream, a 12px radius and 16px/20px
insets, reducing to 16px insets on phone. Loading, empty, unavailable, failed and
pagination states reuse existing feedback and retry controls.

The transaction review and reply forms remain within AccountShell task panels,
using the shared Field, textarea, Button and ActionFeedback. The rating band has
five native 48×48px radio targets; keyboard selection fills the chosen range,
keeps visible focus and announces the selected number. Comment is optional;
rating, character count, deadline, public visibility and immutability are stated.
Review/reply submission uses the existing critical-action recovery for pending,
committed and uncertain responses. Field text retains the incumbent 16px size.

Public-photo settings reuse a native checkbox and status/error feedback. The
checked state follows the server-confirmed preference, which defaults off.
The shared avatar falls back to an initial when the public photo is absent or
fails; listing-owner and review-author links lead to the same public profile.

Reporting reuses the centered native SearchDialog with White/Forest, the existing
20px radius, viewport-limited height and internal scrolling. The copy explains
that reasons remain private. Initial focus, Tab containment, Escape, body scroll
lock and focus restoration follow that shared dialog. Sent feedback is displayed
only after the server confirms the report. Admin report detail adds scoped
content, visibility and reason controls to the incumbent admin layout and
critical-action flow; this is a feature extension within that legacy layout.

## Finish review and capture scope

The fresh finish reviewer returned **SHIP** for this extension: evidence valid,
persistence pass, fidelity matches the approved existing-system direction,
the ceiling is reached within the incumbent system, and **material fixes: none**.
No new visual world or generated design comp was introduced.

All 14 named captures under [profiles evidence](../review/profiles/) were inspected:
profile, reviews, form, reply, report, admin and narrow, each with desktop/mobile
filenames. Desktop captures use a 1440×900 viewport and phone captures 390×844;
both narrow captures use a 320×800 viewport. Profile, reviews and narrow are full
page captures, so their PNG heights exceed the viewport. Form, reply, report and
admin capture the viewport. The native Next development indicator in these
captures is tooling, outside the product UI.

## Recorded verification and system boundary

The existing verification records show 140 passing desktop/mobile browser feature
and regression cases, including two flows through the real API, followed by 26
passing feature confirmations after correcting avatar initial contrast and back-link alignment. Covered behavior includes URL tabs, the 4/2 grid, plain review text,
error/retry/404 states, radio keyboard use, optional comments, input limits,
uncertain-response recovery, replies, report focus/privacy, server-confirmed photo
preferences, scoped admin moderation and long content at 320px. The real API flows
complete a transaction, publish a rating, reply and open its notification.

Ten API suites and six formula tests passed, with the feature record detailing
permissions, transaction eligibility/deadlines, version/idempotency/concurrency,
notification rollback, public projections, photos, correction, moderation,
reports and retention holds. Typecheck, lint and the production build passed;
the Next build lists /profil/[id] as dynamic. Diff checking and JSON parsing passed.
The saved detector result at .local/reviews-detector.json is []. These are the
recorded checks for this extension and its included regressions; this documentation
pass inspected source, logs and captures without rerunning tests or the detector.

[DESIGN.md](../../DESIGN.md) and [its sidecar](../design.json) are preserved by this
pass: no approved primitive, token or system change occurred. The values above
describe this surface's component application. Earlier review scope notes retain
their historical meaning. The older catalog-only wording for compact card rules,
earlier mobile navbar descriptions, and sidecar preview/scope coverage remain
unmodified. The legacy admin eyebrow and layout visible in the admin captures
are inherited drift, not new reusable guidance; they are neither repaired nor
canonized by this ordinary feature extension.
