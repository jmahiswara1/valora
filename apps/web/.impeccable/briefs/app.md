# User account redesign — shipped 2026-10-04

Mode Operate. Code-led expansion of the approved Valora white/forest/cream Plus Jakarta Sans world. The user approved all 21 USER /app page entrypoints, a compact sidebar, an activity-first dashboard, and preservation of existing form steps. Admin /app/admin and PUBLIC /passport/[id] are excluded; the owner Passport /app/barang/[id]/passport is included. Existing visual authority and the approved structure made seed, comp generation, asset generation, seed-roll, and comp-diff gates inapplicable.

## Direction

Unframed white workspace with a Cream fixed sidebar, shadowless sticky toolbar, flat rounded photos and task panels. Plus Jakarta Sans retains the established 500/600/700 weights and brand colors. Fixed task headings, readable 16px fields, explicit statuses, and one primary action per group. The implementation carries the existing visual world into the account area.

## First viewport

A 240px sidebar starts at viewport 1024px. The desktop toolbar supplies breadcrumbs, Market, and account controls. Below 1024px, a native modal navigation drawer preserves keyboard focus, Escape/backdrop dismissal, route-close, and focus return. Toolbar height is 76px/68px. Account content uses 24px horizontal gutters and a 1500px maximum width; through 600px it uses 16px gutters.

Ringkasan shows the greeting and add-item action, then transaction reminders, offers requiring a response, and unread conversations, followed by four recent goods. Activity derives from the complete relevant API arrays; the recent-goods request uses limit=4. No first-page goods/transaction counts or invented statistics are presented.

## Visitor path

The 21 entrypoints cover Ringkasan; goods list/create/detail/edit; assessment list/create/result; Repair; owner Passport; Listing list/create/detail and revisions; offers; transactions list/detail; messages list/thread; participant correction; user Impact; and profile/photo/security/sessions/closure. The complete source path inventory is in .impeccable/design.json extensions.accountWorkspace.entrypoints.

Item grids use available content width: one column below 480px, two from 480px, three from 760px, four from 1000px, gap 16px. The desktop message workspace uses list and thread panes; through content width 760px it presents list or thread. Existing form sections, route/API/DTO/business rules, version/idempotency contracts, reservations, critical confirmations and session privacy are preserved.

## Signature interaction

Compact status and action vocabulary carries an activity from Ringkasan into its detail. Shared task-aware route metadata keeps the active group across nested routes. Corrections stay under Transaksi with the leaf Peninjauan koreksi; assessment creation is Penilaian baru and goods creation is Tambah barang. Native photo selection is keyboard-operable. Chat retains scroll position when loading older history and preserves draft/stable retry IDs through failures. Pending, retry, conflict, and recovery states retain user input and previously loaded rows.

## Constraints

Private photos use signed session-protected access. User Impact retains Asia/Jakarta periods, units, source notes, weight coverage and Belum tersedia. Email verification is explained once in AccountShell. Profile closure is separate from session management and requires the typed confirmation. Shared Admin/public component behavior remains governed by its existing scope; AppShell branches to legacy AdminAppShell for /app/admin. No new backend feature or raster asset is part of this change. Existing local photos are used only in intercepted review fixtures.

## Shipped source and system handoff

Authoritative values come from src/styles/account.css, with font/control inheritance in src/styles/globals.css and src/app/layout.tsx. Shell/control sources are src/components/layout/account-shell.tsx, src/features/account, src/components/layout/app-shell.tsx and src/app/app/layout.tsx. Shipped user surfaces are grouped in src/features/items, src/features/assessments, src/features/listings, src/features/offers, src/features/conversations, src/features/transactions, src/features/passport, src/features/impact, src/features/corrections and src/features/profile. Critical-action logic is in src/hooks/use-critical-action.ts; shared controls are in src/components/ui. The complete old-to-new mapping is in docs/22-file-organization.md at the workspace root.

DESIGN.md frontmatter records scoped account typography, color/state roles, exact control/card/photo shapes, spacing and components. The sidecar records grid/gutters, viewport versus container breakpoints, source references and one standalone account-control preview. Existing public/Auth/Market tokens, previews and historical stage reviews are retained. Local 10/14/9/5px radii and warning/hover/photo-control/secondary text colors are documented by their shipped roles.

## Final review and evidence

The approved bounded finish completed typecheck/lint, intercepted user flows and critical mutations, renders at 320/390/768/1024/1440px, drawer/dialog/keyboard checks, loading/empty/error/pagination recovery, session/role guards and Admin/public scope regressions. No real backend mutation was performed.

[Initial independent review](../review/app/review.md) inspected all 58 captures and requested four material fixes. The correction batch restored phone chat typing space, Transaksi context for correction routes, the assessment creation breadcrumb, and a 24px desktop recommendation gutter. Existing phone form steps and single-column recommendation reflow were preserved.

[Independent verdict](../review/app/verdict.md) gives disposition ship **at the scope of those four scored findings**. All four are resolved after the reviewer reopened 10 affected captures and sampled source. The initial review remains the full account surface review; the verdict does not extend that review to Admin, PUBLIC Passport or real backend integrations.

[Final verification](../review/app/verification.md), [inspection manifest](../review/app/inspection.json), [interaction results](../review/app/interactions.json) and [regressions](../review/app/regressions.json) record typecheck/lint passing, all 39 intercepted frontend scenarios passing, and 58 final capture files with 0 runtime errors/0 horizontal document overflow. The manifest has 57 paths plus the drawer capture. It includes all 21 user pages at 1440/390px, dashboard at 320/768/1024px, seven task pages at 320px, and long-name/empty/error/unverified/reserved states.

The detector ran once: 0 anti-patterns and 25 advisory notes for intentional source-backed local roles. No second detector or further polish pass ran. Regression evidence confirms the retained 235px legacy Admin sidebar, public desktop Market grid, square PUBLIC Passport summary and AuthShell. These are fixture frontend and style/scope checks; real backend upload, payment, ownership transfer and mutations are not asserted. Documentation is complete for this shipped user-account extension.
