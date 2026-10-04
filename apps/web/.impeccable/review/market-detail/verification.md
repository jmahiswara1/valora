# Market detail verification — 2026-10-04

Typecheck and lint pass. One detector pass found no primary findings and one intentional17px owner-name typography advisory. Detail page adopts PublicShell; catalogue four-column layout unchanged.

Five live public listing captures at1440,1024,768,390,320 with viewport and full-page evidence. Lazy related photos loaded by bounded scroll before full capture. inspection.json: HTTP200, no JS errors/overflow, desktop split and below900px single-column, related4/4/2/1/1columns, four cards excluding current, sticky header and guest login returnhref. Public-fixture.json records real public data used; demo disclosures retained.

interactions.json records21 passed scenarios, covering safeNext redirect/admin guards, guest login return, email verification, three correct offer bodies, synchronous double-submit prevention, stable-ID retry and changed-payload ID, conflict reload, chat error/retry/duplicate prevention/navigation, gallery keyboard and close-form focus, RESERVED/404/transport/loading, exchange empty/error recovery, missing/broken photos, long title/description, missingScore, related empty hiding and session recovery. All login/offer/chat writes intercepted, no real accounts, offers, chats or transactions created. Additional gallery/state photos are synthetic UI fixtures; main live photos and data come from API. No test suite added.

Required captures (22):
- conflict.png
- detail-1024.png
- detail-1440.png
- detail-320.png
- detail-390.png
- detail-768.png
- error-390.png
- extremes-320.png
- gallery-1440.png
- loading-390.png
- missing-390.png
- no-photo-320.png
- offer-donate.png
- offer-exchange.png
- offer-resell.png
- reserved-390.png
- unverified-1440.png
- viewport-1024.png
- viewport-1440.png
- viewport-320.png
- viewport-390.png
- viewport-768.png

Capture validity notes: Next development badge visible. Gallery fixture uses existing /images/chair.webp and books.webp as distinct images to exercise selection; they are fixture media, not claims about actual listed goods. Offer screenshots are intentional scoped form crops. Related query same category, limit5 then exclude current/slice4. Eligibility/owner/block constraints remain server-authoritative; current public DTO has no ownerId.
