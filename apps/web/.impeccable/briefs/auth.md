# Account surfaces — redesign phase 2

## Confirmed brief

The user approved implementation of the plan on 2026-10-04. Mode: Operate. Indonesian guests need to sign in, create an account, recover a password, or verify email. Success is completing the existing account task with understandable feedback, while matching the renewed public visual system.

## Direction contract

- Inherit the established white/forest/cream system and Plus Jakarta Sans 500/600/700. Full-width white canvas, 24px desktop and 16px phone gutters, no rounded outer page wrapper or decorative shadows.
- Keep shared sticky navigation without a border or shadow, renewed wordmark, and account disclosure. Latest user steering: notification and cart/offer icons exist only for authenticated sessions, across all shared SiteHeader routes. Guests retain Cara kerja, Impact, account, and the mobile menu.
- Desktop: two columns, an existing rounded editorial photo on the left with “Satu tempat untuk barang yang kamu miliki.”, and an unframed task form on the right, maximum 480px wide. The image includes household objects, books, and electronics. Tablets retain the split, with a slightly wider form column. At 700px and below, hide the story and show the form first. No footer.
- Page titles are h1; story title is h2. Controls use 12px corners, primary actions are forest pill buttons, and informational notices use cream, success sage, errors the established danger treatment.
- Registration remains one step with display name, email, city, password, confirmation. Password inputs expose a native 44px toggle with pressed state, linked controls, and no submit behavior. Keep autocomplete, required semantics, linked help/errors, keyboard focus, pending labels, duplicate request guards, and keyboard city selection.
- Preserve endpoints, payloads, registration schema, minimum 12 characters, session state, safeNext, reset-success query, and all existing redirects. Add recovery links for incomplete reset links and recovery success. No new API or schema.

## Scope and evidence

Routes: /masuk, /daftar, /lupa-kata-sandi, /reset-password, /verifikasi-email. CSS is scoped to auth-surface, with public tokens inherited; shared Input ref typing and Field help/error IDs support the account forms without changing dashboard styling.

Browser evidence lives in .impeccable/review/auth: five route captures at 1440, 768, 390, and 320px, inspection.json, and interactions.json. Interaction scenarios use intercepted API responses to avoid creating accounts or sending email; they are frontend behavior evidence, not backend integration proof. No new test suite.

Detector ran once on auth.css and features/auth/forms.tsx: no primary findings; two font-size advisories describe intentional scales now recorded in DESIGN.md frontmatter and sidecar typography metadata: story h2 clamp(32px, 3.2vw, 48px), task h1 clamp(30px, 3vw, 42px), and mobile task h1 clamp(30px, 7.7vw, 36px).

Finish review: SHIP with no required fixes, recorded in .impeccable/review/auth/review.md. Documentation records this reviewed account scope and authenticated-only activity rule; it does not extend older public verdicts or claim dashboard migration.
