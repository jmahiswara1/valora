# Graph Report - insyfest  (2026-09-28)

> Snapshot analisis awal: PRD v1.12 dan 11 dokumen sebelum penutupan K01–K06. Untuk aturan terkini, baca [PRD v1.14](../PRD.md) dan [indeks docs](../docs/README.md). [Audit temuan](../docs/14-graphify-audit.md) menjelaskan bagaimana graph ini dipakai.

## Corpus Check
- Corpus is ~19,061 words - fits in a single context window. You may not need a graph.

## Summary
- 135 nodes · 243 edges · 14 communities (11 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 34,708 input · 28,200 output

## Community Hubs (Navigation)
- Transaction dan Impact
- Assessment dan Score
- Dokumen dan Keputusan
- Listing dan Offer
- Passport dan Privasi
- Rubrik dan Keselamatan
- Empat Jalur MVP
- Moderasi dan Sengketa
- Pencil dan UI
- Fondasi MVP Valora
- Lomba dan Demo
- Web Admin
- Web Publik
- Web Pengguna

## God Nodes (most connected - your core abstractions)
1. `Transaction` - 18 edges
2. `Listing` - 16 edges
3. `Assessment` - 13 edges
4. `MVP category case matrix` - 12 edges
5. `Valora Product Requirements Document` - 11 edges
6. `Preimplementation documents index` - 11 edges
7. `Offer` - 10 edges
8. `API` - 9 edges
9. `Moderation policy draft` - 9 edges
10. `Valora Score` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Unverified TERVERIFIKASI badge` --conceptually_related_to--> `Valora Score`  [EXTRACTED]
  docs/04-pencil-design-review.md → PRD.md
- `Media` --shares_data_with--> `Listing`  [EXTRACTED]
  docs/05-technical-plan.md → PRD.md
- `Transaction state machine` --implements--> `Transaction`  [EXTRACTED]
  docs/02-flows-and-states.md → PRD.md
- `Immutable Assessment snapshot` --references--> `PARTIAL_ECONOMIC Assessment`  [EXTRACTED]
  docs/03-domain-and-scoring.md → PRD.md
- `Product decisions` --references--> `Valora Product Requirements Document`  [EXTRACTED]
  docs/01-product-decisions.md → PRD.md

## Hyperedges (group relationships)
- **Four Valora MVP action paths** — prd_repair, prd_resell, prd_exchange, prd_donate [EXTRACTED 1.00]
- **Atomic transaction completion** — prd_transaction, prd_ownership_transfer, prd_passport_event, prd_impact_event [EXTRACTED 1.00]
- **Three category moderation treatments** — docs_09_moderation_policy_draft_prohibited, docs_09_moderation_policy_draft_special_review, docs_09_moderation_policy_draft_disclosure [EXTRACTED 1.00]

## Communities (14 total, 3 thin omitted)

### Community 0 - "Transaction dan Impact"
Cohesion: 0.18
Nodes (18): Public operation readiness, O09 Impact correction, O11 operations and deployment, Completed Transfers, Atomic completion consistency, Estimated Transfer Weight, Impact event ledger, API (+10 more)

### Community 1 - "Assessment dan Score"
Cohesion: 0.20
Nodes (18): Immutable Assessment snapshot, Economic Value formula, Items Revalued, Weighted Score formula, AI Explainer backend service, Five level answer anchors, Rubric release gate, Six category indicators (+10 more)

### Community 2 - "Dokumen dan Keputusan"
Cohesion: 0.23
Nodes (17): INSYFEST 2026 competition context, Product decisions, O05 category scoring rubrics, O06 moderation details, O07 Passport privacy and moderation, O08 account and data retention, User flows and product states, Domain, Score, Passport, Impact, and privacy (+9 more)

### Community 3 - "Listing dan Offer"
Cohesion: 0.20
Nodes (15): O04 Listing status branches, Material Listing change cycle, Listing state machine, Offer lifecycle, PostgreSQL, Transaction locking and uniqueness, Allowed with condition disclosure, Listing review checklist (+7 more)

### Community 4 - "Passport dan Privasi"
Cohesion: 0.19
Nodes (13): Actor access boundaries, Repairs Recorded, Passport visibility matrix, Media, Passport access policy, Owner Passport projection, Repair history sharing consent, Guest (+5 more)

### Community 5 - "Rubrik dan Keselamatan"
Cohesion: 0.15
Nodes (13): Books category, Clothing category, Electronics category, Furniture category, Hobby category, Initial hobby subcategories, Home appliances category, Keyboard Score worked example (+5 more)

### Community 6 - "Empat Jalur MVP"
Cohesion: 0.33
Nodes (11): Handover confirmation matrix, Transaction state machine, Confirmed Sale Value, Recommendation eligibility status, Donate path, Exchange path, PARTIAL_ECONOMIC Assessment, Recommendation Engine (+3 more)

### Community 7 - "Moderasi dan Sengketa"
Cohesion: 0.29
Nodes (10): Cancellation and dispute policy, Admin case Passport projection, Moderation audit, Prohibited category conditions, Special admin review, Admin, AdminAction, Transaction dispute (+2 more)

### Community 8 - "Pencil dan UI"
Cohesion: 0.22
Nodes (10): Design audit findings, Landing mobile four card layout issue, Valora Pencil canvas, Pencil screen inventory, Unverified TERVERIFIKASI badge, Design token contrast checks, Responsive editorial layout, Newsreader, Funnel Sans, IBM Plex Mono typography (+2 more)

### Community 9 - "Fondasi MVP Valora"
Cohesion: 0.50
Nodes (4): INSYFEST 2026, Implementation phases 0–6, Valora MVP, Valora

### Community 10 - "Lomba dan Demo"
Cohesion: 0.67
Nodes (3): Official competition guidance, Valora demonstration scenarios, Decision log D01–D20

## Knowledge Gaps
- **40 isolated node(s):** `Guest`, `Message`, `Valora Impact`, `recommendation-v1`, `INSYFEST 2026` (+35 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 41 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Listing` connect `Listing dan Offer` to `Transaction dan Impact`, `Assessment dan Score`, `Passport dan Privasi`, `Empat Jalur MVP`, `Moderasi dan Sengketa`?**
  _High betweenness centrality (0.174) - this node is a cross-community bridge._
- **Why does `Transaction` connect `Transaction dan Impact` to `Listing dan Offer`, `Passport dan Privasi`, `Empat Jalur MVP`, `Moderasi dan Sengketa`?**
  _High betweenness centrality (0.167) - this node is a cross-community bridge._
- **Why does `Assessment` connect `Assessment dan Score` to `Transaction dan Impact`, `Listing dan Offer`, `Passport dan Privasi`, `Empat Jalur MVP`?**
  _High betweenness centrality (0.166) - this node is a cross-community bridge._
- **What connects `Guest`, `Message`, `Valora Impact` to the rest of the system?**
  _40 weakly-connected nodes found - possible documentation gaps or missing edges._
