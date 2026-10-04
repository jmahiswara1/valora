# Layanan and Tentang kami — footer expansion

Approved on 2026-10-04. Mode: Read. Public visitors learn about existing Valora features, the product's purpose and principles, and common account/item/transaction questions before deciding to act.

## Direction contract

- Inherit the renewed public white/forest/cream, Plus Jakarta Sans, full-width white canvas, existing gutters, rounded media and restrained flat sections. No outer rounded page wrapper, decorative shadow, fabricated company/team/contact information, or new service backend.
- Shared footer now has four groups in this order: Jelajahi, Layanan, Tentang kami, Akun. Existing Jelajahi and Akun links stay. Keep green rounded footer card, large Valora mark, visual-only social icons and inset matching the closing CTA. Four navigation columns on desktop; two at 1023px and below with the brand above navigation. Phone links keep min-height 44px and padding-block 6px; public phone navigation gap is 24px. Text wraps and keyboard focus stays visible.
- /layanan has public metadata, shared shell and a photo-led information header. Four semantic sections: #passport, #penilaian, #perawatan, #jual-tukar-donasi. Explain existing feature behavior and limits, link to relevant Cara kerja sections or Market, and reuse session-aware RecordItemLink for Mulai mencatat.
- /tentang-kami has public metadata, shared shell, introductory #valora, cream #misi principles panel, and #faq with five native details/summary questions: email verification, recording items, Score meaning, Listing publication/offers, payment/handover. Use verified product context including INSYFEST 2026; no legal or financial advice.
- Footer destinations: Valora Passport -> /layanan#passport, Penilaian kondisi -> /layanan#penilaian, Catatan perawatan -> /layanan#perawatan, Jual, tukar & donasi -> /layanan#jual-tukar-donasi; Tentang Valora -> /tentang-kami#valora, Misi & nilai -> /tentang-kami#misi, Pertanyaan umum -> /tentang-kami#faq.
- Explain that Score is not a condition certificate or price guarantee; maintenance records are documentation of work arranged by the owner; Listing review/email verification and party-arranged payment/handover follow existing product rules. No changes to APIs or schemas; the route inventory adds the two public pages.

## Verification boundary

Review at 1440, 768, 390 and 320px for both new pages and shared footer on home/Market. Verify footer links reach their exact anchors with headings below sticky navigation, native FAQ keyboard expansion/collapse, responsive column counts, metadata, and no overflow. Use typecheck/lint; no new test suite. Existing imagery reused without creating or changing raster assets.


## Implemented scales and evidence

DESIGN.md frontmatter and sidecar metadata record the intentional information roles: service/closing h2 clamp(25px, 2.8vw, 32px), mobile service/mission h2 27px, service body 15px (14px mobile), Cream notes 13px, principle h3 20px (18px mobile), and FAQ summary 16px (15px mobile). Phone information overrides apply at 639px. FAQ retains native details/summary keyboard behavior, shared name valora-faq, and plus/minus disclosure marks.

.impeccable/review/footer-pages contains sixteen captures for services, about, home-footer, and market-footer at 1440, 768, 390, and 320px, inspection.json, and verification.md. Source verification reports typecheck and lint passed, zero primary detector findings and six intentional typography advisories. Browser evidence records HTTP 200, no overflow or JavaScript errors, native FAQ keyboard expansion/collapse, and fourteen anchor navigations with headings below sticky navigation. Finish review is recorded separately after its result is available; this evidence does not extend older review verdicts or claim a global audit. No API/schema changes or new raster assets.
