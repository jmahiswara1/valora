# Passport stack — scoped implementation review

The Home Passport panel follows the approved three-card proposal and supplied reference. Profile is the default front card; selecting another exposed title brings it to the front. White cards, sage surroundings, the existing chair illustration, and cream choice labels retain the public design system. There are no shadows or autoplay.

The profile contains the chair name, category, and illustrative recording year 2026. Condition & care shows unassessed/unrecorded example states. Next story explains Rawat, Jual, Tukar, and Donasikan. The visible illustration label identifies this as a conceptual Passport. No user record, assessment, care event, or transaction is created. Links use existing Cara Kerja routes.

Source scope: `src/components/passport-stack.tsx`, `src/app/page.tsx`, and `src/app/public.css`. Documentation updates cover DESIGN.md, its schema 2 sidecar, the public brief, and the design-system migration note. Existing asset provenance applies to the reused chair image.

## Verification

- Three card states captured at 320, 390, 768, 1440, and 1920px: 15 renders, with one visible content panel per state.
- Final measurements show no horizontal document overflow or content extending past the card boundary. Title hit areas measure approximately 44px (subpixel rounding under scaling).
- Native button Space activation returns Profile to the front at all five widths; focus stays on the chosen button with a visible 3px outline. Hidden card content is removed from keyboard navigation.
- Repeated pointer selection works with normal motion. Transform changes take 350ms; reduced-motion effectively disables the transition through the shared rule.
- No browser page errors occurred. Existing navigation paths remain available.
- Typecheck and lint pass on the final implementation.

The first inspection found the narrow Condition link extending past its content box. A single correction increases card/content height below 360px and requests sufficiently large images for the tall crop. The final confirmation reports no overflow. Representative desktop, tablet, mobile, narrow, and wide renders were opened and inspected. The 320px component capture uses a taller viewport to fit the whole panel; the footer link is visible and inside its panel.

DESIGN.md describes the three card states and interactions; its new Public Passport Stack sidecar entry previews only the default state. This is root's scoped source, render, and interaction review. Earlier canvas and navbar verdicts do not cover this component; no new automated suite or production build was run.
