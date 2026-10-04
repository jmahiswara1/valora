# Shared sticky navbar refinement

Date: 2026-10-03

## Request and scope

The right side of the public navbar follows the supplied reference: two text links and thin outlined circular bell, cart, and account icons. The shared header is sticky and opaque white, without a border or shadow; the thin icon circles remain. Existing Valora pages provide the text destinations: Cara kerja and Impact. The full white canvas and 24px / 16px public gutters remain in place.

Source changes include `src/components/site.tsx`, `src/app/globals.css`, `src/app/public.css`, and `src/app/page.tsx`. This refinement applies to public `SiteHeader` instances, including the existing marketplace and authentication pages; their page bodies are outside this change. The renewed wordmark has no slogan, and the hero caption “Barang lama. Cerita baru.” was removed.

## Destinations and interaction

- Bell opens the existing account overview and reminders at `/app`.
- Cart opens existing offers at `/app/penawaran`.
- Account opens `/masuk` for guests and `/app/profil` for authenticated users.
- Guests visiting private activity destinations go through login with the existing `next` return route.
- Icon targets are 44px square with a 34px visual circle. All icons have accessible names and visible keyboard focus.
- At widths up to 700px, text links move into the mobile menu; all three activity icons remain visible. Escape closes the menu and returns focus to its trigger.

## Checks performed

| Check | Result |
| --- | --- |
| Web TypeScript check | Pass |
| Web lint | Pass |
| Isolated production build | Pass; 45 routes |
| Home at 320, 390, 768, 1440, 1920px | Header remains at top 0, including after scrolling 1200px |
| Six public routes | Shared header inspected on `/`, `/cara-kerja`, `/impact`, `/market`, `/masuk`, `/daftar` |
| Measured geometry | 22 snapshots; no horizontal document overflow, non-sticky headers, or incorrect icon target sizes |
| Mobile menu | Both 320px and 390px menus opened; Escape closes them and restores focus |
| Render inspection | All 22 PNG captures opened and visually inspected by root |

`inspection.json` contains 22 geometry observations and two Escape observations. The PNG evidence covers five Home top states, five Home scrolled states, two mobile menus, and ten shared-header crops for the other five routes on desktop and mobile. After the no-border and no-slogan correction, all 22 captures were regenerated; root spot-checked the Home desktop/mobile views and renewed/classic desktop headers.

The capture helper performs read-only page inspection. No account data or transactions were changed. The authenticated destinations were checked in source; the rendered captures show the guest state.

The final correction passed TypeScript and lint. The refreshed render records still show 22 sticky geometry states without document overflow, with 44px icon targets; both mobile Escape checks close the menu and return focus. No new automated test suite was run for this navbar refinement. The earlier 20 passing browser cases belong to the preceding full-canvas correction. The earlier independent `ship` disposition scored the 70ch prose fix and does not review this navbar refinement. This note records root's scoped source and render inspection.
