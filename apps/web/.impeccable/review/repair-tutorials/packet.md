# Repair tutorials — finish review packet

Project: `E:/Project/insyfest`, app: `apps/web`. Date: 2026-10-16.

## Request and authority

Implement the agreed interactive repair/maintenance tutorial plan as an ordinary Valora account extension. Operate mode. Preserve the existing white/forest/cream/sage palette, Plus Jakarta Sans and account shell. Authority: `apps/web/PRODUCT.md`, `apps/web/DESIGN.md`, `apps/web/.impeccable/design.json`. Direction contract: `.impeccable/briefs/repair-tutorials.md`. Craft floor: `C:/Users/jmahiswara/.agents/skills/impeccable/reference/craft-floor.md`. No comp or new visual world was requested for this extension.

Confirmed product scope: six curated guides in five categories; preparation without mandatory Assessment; explicit Market start confirmation; ordered user-reported steps; pause/resume; bounded Q&A with optional selected private photos; one unclosed session per item; review before exactly one record; REPAIR distinct from MAINTENANCE; private conversation history; original geometric diagrams. AI never auto-advances progress or claims physical success. No automatic tests were added or run, per developer instruction.

## Artifact

`src/features/tutorials/{catalog,list,workspace,questions,review,shared}.tsx`, `src/styles/tutorials.css`, `src/app/app/panduan`, `src/app/app/barang/[id]/panduan`, twelve original SVG diagrams in `public/guides/v1`. Entry links in account shell, item details, Assessment REPAIR recommendation, and the existing manual repair form. Backend/API details in `docs/33-ai-repair-tutorials.md`.

## Required captures

All PNG paths below are relative to this packet's directory. These are the final production build, full-page captures from document top, fonts settled, no developer overlay. Every file has been opened by the builder. Required viewport set: **1440 px, 390 px, 320 px**.

- `desktop.png` (1440): active step and expanded Q&A.
- `mobile.png` (390), `user-320.png` (320): same active step, Q&A collapsed by default.
- `catalog-desktop.png` (1440), `catalog-mobile.png` (390): two matching electronics guides and manual entry point.
- `preparation.png` (1440): required answers initially unknown, start disabled.
- `start-confirmation.png` (390): native centered start confirmation, checkbox and disabled action.
- `paused-mobile.png` (390): saved pause with resume.
- `question-desktop.png` (1440), `question-mobile.png` (390): private questions and honest provider-unavailable history.
- `review-desktop.png` (1440), `review-mobile.png` (390): partial progress review, persisted draft, selected evidence, private sharing defaults.
- `record-confirmation-mobile.png` (390): frozen final confirmation, checkbox gating.
- `recorded-mobile.png` (390): closed recorded maintenance session, no obsolete continue/review control.
- `list-desktop.png` (1440), `list-mobile.png` (390): active sessions, distinct review/paused states, filters.

Native dialog backdrops cover the viewport; the undimmed document below that viewport in a full-page PNG is a browser capture property, not another application backdrop.

## Findings and verification limits

One detector pass ran on the new targets: `detector.json` contains no primary findings and one font-size advisory for the old literal 1.2rem. That declaration was removed so session headings inherit existing account typography. No further detector pass. Its removal does not alter rendered captures because the incumbent account heading rule already won the cascade.

Two bounded builder capture rounds are complete. Build contracts/API/web, typecheck and lint passed before handoff. A synthetic maintenance record saved with one evidence copy and both sharing flags false; a separate partial-result draft persisted over reload. All demo data is explicitly labeled simulation and uses original diagram images, not fabricated physical repair evidence. Gateway port 20128 is not listening, so no successful live AI response is claimed; the unavailable path is captured. Do not claim comprehensive accessibility, concurrency or provider validation from screenshots.

Pre-existing documentation drift: PRODUCT.md describes Fastify while implementation uses Nest/Express; DESIGN.md chat measurements differ from current chat CSS. Preserve these files and report drift without changing unrelated surfaces.

## Review boundary

Fresh finish review only. Do not run browser, tests, or modify implementation. Inspect supplied captures and relevant source. Write findings under `.impeccable/review/repair-tutorials/finish-review.md`. Return the shipped role's five contract sections and exact disposition. If a material issue needs correction, name the smallest fix and the capture(s) needed to judge it.
