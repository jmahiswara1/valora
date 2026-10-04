# Market verification — 2026-10-04

Typecheck and lint pass. One detector pass reported no primary findings, six advisories for intentional catalogue title sizes, filter count, empty title and skeleton radius.

Live API captures: catalog-{1440,768,390,320}.png (full page, scrolling through before capture so lazy photos load), viewport-{1440,768,390,320}.png (initial viewport), filters-{1440,768,390,320}.png (expanded inline panel). inspection.json records all four sizes: no overflow or page errors, sticky header, 3/2/1/1 columns,20 live cards. Hero280px desktop/tablet and230/263px phone, growing for real copy. First card top747px desktop/tablet,751px390px,867px320px; initial catalogue has always-visible search/category/types/sort.

interactions.json records14 passed scenarios. Public GET fixtures simulate empty/initial/next-page failures and next cursor. These verify search Enter, category query, combined filters, city keyboard selection, invalid range and unselected-city request prevention, chip/reset, price/type transitions, next-page retained cards and retry, initial retry, empty recovery, detail links and six skeletons. Additional state captures empty.png and loading-390.png. No account/offer/transaction writes, new backend contracts or automated test suites.

Scope is catalogue only. Public details and dashboard visuals retain their existing style. DESIGN.md contains historical boundaries from earlier migration stages; documenter should append this catalogue migration and update current boundaries, without unrelated drift cleanup.
