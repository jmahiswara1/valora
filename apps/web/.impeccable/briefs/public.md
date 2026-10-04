# Public surfaces — redesign phase 1

Targets: src/app/page.tsx, src/app/cara-kerja/page.tsx, src/app/impact/page.tsx.

Mode: Persuade on Home and Cara Kerja; Read on public Impact.

## Confirmed scope

The user confirmed phase 1 only for this implementation. Home, Cara Kerja, public Impact, and their header/footer adopt the replacement visual system. Auth, Market visual redesign, and dashboards are later phases. Market receives category URL initialization so the landing navigation works.

## Direction contract

**THESIS:** Give everyday belongings another chapter. Visitors first discover Market and then understand Valora's condition, care, and history features.

**OWN-WORLD:** White surfaces, forest-green text and primary actions, small cream/sage fields, Plus Jakarta Sans 500/600/700, rounded photo-led panels and category pills.

**STORY:** A real-looking multi-category interior photo introduces the idea. Two editorial panels explain care and Passport. Live categories filter up to six active Market listings. A compact process and closing CTA invite participation.

**FIRST VIEWPORT:** Wordmark and restrained navigation above a wide rounded forest-green interior photograph. A large white headline sits left; Market and record-item actions remain visible on mobile. Objects on the right establish furniture, electronics, books, and household goods.

**FORM:** User-pinned reference and approved plan; no concept lottery. Three-column desktop, two-column tablet, one-column phone listing grid.

**CANVAS CORRECTION (2026-10-03):** The user rejected the large rounded page wrapper and its empty outer margins. Public pages fill the viewport in white with no outer border, radius, or margin. Content has 24px gutters on desktop/tablet and 16px on phones, with no maximum width. Hero, photos, and cards retain their component rounding. This supersedes the original floating page frame.

**NAVBAR REFINEMENT (2026-10-03):** The user requested a sticky navbar and a reference-inspired right side with two text links and three circular icons. Existing Cara kerja / Impact links carry the two text positions; reminder, offer, and account destinations use existing Valora routes. The original refinement sent guests to login with a return destination for private activities; the authenticated-only activity rule below supersedes guest visibility of those icons. All shared public SiteHeader instances adopt this navigation; page bodies retain their staged scope. The original refinement kept three icons visible at 700px when text links collapsed into the mobile menu; the authenticated-only activity rule below supersedes that visibility requirement. The header has an opaque white field without a border, shadow, or blur; thin icon circles remain. This is a local refinement following the reviewed canvas and 70ch correction; the earlier review verdict does not cover this new navbar.

**ACCOUNT MENU REFINEMENT (2026-10-04):** The user requested that the navbar profile icon no longer navigate directly to `/app/profil`. Make it a disclosure trigger. Authenticated users see Ringkasan, Profil saya, and Keluar; guests see Masuk and Daftar. Preserve access to `/app/profil` as an explicit menu choice. Close on route links, outside pointer, or Escape; Escape restores focus to the trigger.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

**PASSPORT STACK (2026-10-03):** The user approved a three-card stack in the Home story panel, matching the supplied layered-card reference. Profile is the default front card, followed by Condition & care and Next story; selecting an exposed title brings that card forward. Use the existing chair illustration, an explicitly illustrative recording year 2026, unassessed/unrecorded example states, and educational links to Cara Kerja. Keep white/green/cream, no shadows, keyboard controls, 44px title targets, and reduced-motion support. This scoped component follows root's source and render inspection; earlier canvas/navbar evidence does not review it.

**FOOTER REFINEMENT (2026-10-03):** The user requested a larger Valora wordmark, social/contact icons in place of the descriptive sentence, and clearer Market/Cara kerja/Impact/Daftar/Masuk navigation. Use four 44px visual icon marks (Instagram, TikTok, Gmail, YouTube) as non-linked icons until official accounts are supplied. Split links into Jelajahi (Market, Cara kerja, Impact) and Akun (Daftar, Masuk). The user then requested a rounded Forest card with 24px desktop/18px phone radius and outer canvas gutters of 24px/16px. Footer content inset matches the “Mulai dari satu barang.” card: 40px desktop, 32px tablet, and 28px phone. Keep responsive spacing, focus styles on links, and the classic Forest surface.

**AUTH AND INFORMATION FOLLOW-UP (2026-10-04):** Phase 1 remains the historical public redesign scope above. The approved subsequent work migrates /masuk, /daftar, /lupa-kata-sandi, /reset-password, and /verifikasi-email through AuthShell, and adds /layanan and /tentang-kami through PublicShell. Auth pages omit the footer. Shared footer navigation now has Jelajahi, Layanan, Tentang kami, and Akun: four columns on desktop and two at 1023px and below, with the brand above the navigation. Phone links have 44px minimum targets, 6px vertical padding, wrapping labels, and 24px public navigation gaps. Existing Forest card, radii, and insets remain the established treatments. Detailed contracts live in auth.md and information.md.

**AUTHENTICATED ACTIVITY RULE (2026-10-04):** Latest user steering applies to every shared SiteHeader. Bell and cart/offer icons render only when session.state is AUTHENTICATED. Guests keep the account disclosure and Market/Cara kerja/Impact text links, with text links in the mobile menu at 700px and below. This supersedes the earlier always-visible icon direction without changing its historical review boundary.

## Data and acceptance

- Category and listing data use existing API endpoints. Empty/error/loading states include recovery; card media includes a missing-photo state.
- Market links retain the selected category. Record-item CTA respects authenticated state.
- Cara Kerja describes currently implemented workflows. Public Impact retains all five metrics, periods, sources, and notes.
- Verify 390, 768, 1440, and 1920 px, exact gutters, full-width flat canvas, keyboard focus, long content, failed media, and absent data. Preserve the current auth and private-route behavior.

**MARKET NAVIGATION (2026-10-04):** User requested Market in the shared navbar. Desktop order is Market, Cara kerja, Impact; mobile keeps its existing single Market destination. Active routes use aria-current. Sticky positioning and session-based activity icon visibility remain in effect.
