disposition: fix

## Disposition

Independent finish review of the approved code-led account redesign. All 57 images named in `inspection.json`, plus `drawer-390.png`, were opened and inspected: 21 user pages at 1440/390px, dashboard at 320/768/1024px, seven narrow task pages, and the long-name/empty/error/unverified/reserved states. Required captures are present, valid, and show the claimed task and document top. Four bounded fixes remain; no rebuild or new visual direction is needed.

## Material fixes

1. **Restore a usable phone chat composer.** In `src/app/account.css:260–261` and `:330–331`, override the inherited `width: 100%` on `.chat-composer .button` from `src/app/globals.css:555` with an intrinsic-width, nonshrinking send button; retain a flexible textarea with room to read and edit a message. [thread-390.png](thread-390.png) and [thread-320.png](thread-320.png) show the textarea compressed to approximately 26px while Kirim occupies nearly the whole row. This contradicts the comfortable small-screen task/control promise; successful intercepted send scenarios and zero document overflow do not establish usable typing space.
2. **Keep corrections in the Transaksi navigation context.** `src/components/account-shell.tsx:30` only matches literal navigation prefixes, while `:54–58` resolves breadcrumbs from the same prefixes and final path segment. Map `/app/koreksi/[id]` to the Transaksi group and provide a correction leaf label through shared task-aware route metadata. [correction-1440.png](correction-1440.png) has no active sidebar entry and only `Ruang saya > Detail`, despite its transaction return link. The desktop sidebar and mobile drawer must both retain this group under the approved nested-route promise.
3. **Name the assessment creation task correctly in breadcrumbs.** The unconditional `baru: 'Tambah barang'` mapping at `src/components/account-shell.tsx:24`, used by `:57`, also labels `/app/barang/[id]/penilaian/baru` as adding a good. [assessment-new-1440.png](assessment-new-1440.png) visibly says `Ruang saya > Barang saya > Tambah barang` above `Nilai Keyboard mekanis`. Resolve this route as `Penilaian baru` or `Buat penilaian`; preserve the existing form steps and route.
4. **Separate the two desktop assessment action columns.** `src/app/account.css:169` sets the recommendation grid gap to zero, and `:173` removes both columns' inset spacing. Give the grid a horizontal gutter, retaining its existing phone single-column reflow. [assessment-detail-1440.png](assessment-detail-1440.png) and [assessments-1440.png](assessments-1440.png) show the left `Dapat dipilih` badge immediately touching the next `Resell`/`Donate` heading, so adjacent actions read as one group. This is a grouping defect, not a request for additional cards or ornament.

## Conformance

| Approved requirement | Review result | Evidence |
| --- | --- | --- |
| TYPE: Plus Jakarta Sans, restrained task hierarchy | match | One familiar family, compact fixed account titles, readable 16px controls; small headings and metadata stay consistent across the 21 page pairs. |
| MATERIAL: flat rounded panels/photos, native task affordances | match except composer | Real fixture photos, border or flat color depth, native selects/file inputs/disclosures, explicit confirmations and password controls; phone typing space is the material fix above. |
| GROUND: white workspace, forest/cream identity | match | White unframed canvas, cream 240px sidebar/activity surfaces, forest actions/current selection; no giant rounded page container. |
| Activity-first summary and four recent goods | match | dashboard-1440/390/320/768/1024, including useful empty/error states and a wrapping long name; activity precedes the goods grid. |
| Sticky shadowless toolbar and mobile drawer | match | Capture composition and supplied sticky/focus/Escape/route-close interaction evidence agree; drawer-390 shows the same restrained navigation vocabulary. |
| Active nested task group and accurate breadcrumb | contradicted on identified routes | Correction loses Transaksi; assessment creation is labeled Tambah barang. Other captured nested goods, Listing, transaction and chat pages keep their group. |
| Full task breadth, preserved forms and privacy explanations | match | Goods create/edit/detail, private Passport, assessment create/results, Repair, Listing create/revision, offers, transactions, chat, correction evidence, Impact and profile are all present and readable; reserved-item and verification states explain available actions. |
| Generous but efficient spacing and task grouping | match except desktop recommendations | Forms remain comfortable at 320/390px; the assessment grid needs its horizontal separation restored. |

The chosen Operate quality bar is otherwise reached: familiar controls, restrained semantic surfaces, consistent stroke icons, visible focus styles, role-specific transaction affordances and a clear account security/closure separation. Code-led composition is explicitly approved; no comp, generated plate, seed roll or comp-diff gate applies.

## Polish notes

No additional stylistic inventions are requested. Keep the compact sidebar, activity priority, broad white canvas, readable phone forms, contained main photos, flat panels and consistent action shapes while applying the four fixes. The reported detector result is 0 anti-patterns; its 25 notes concern intentional local control/photo radii and secondary state colors. Those values should be recorded in the planned documentation handoff, not treated as aesthetic failures.

## Production notes

The supplied verification reports typecheck/lint passing, 33 intercepted frontend interaction scenarios passing, and 0 runtime errors/0 horizontal document overflow across 58 captures. I inspected the images and sampled the account CSS, shell, shared account controls and chat markup; I did not run a browser, recapture, rerun the detector, mutate app data or edit implementation files. The observations above identify layout/navigation defects that those existing checks did not catch.

Session guards in `account-shell.tsx:63–67` withhold private children until the authenticated route is verified, including unavailable/logout-pending states. The interaction report covers signed/private photo behavior, reservations, pending/retry/version/idempotency behavior, critical confirmations, Impact periods/coverage and account session/closure protections. These are fixture frontend evidence, not claims of real backend upload, payment or ownership integration.

`regressions.json` records the retained legacy admin shell, public Market grid, public Passport styling and AuthShell. Admin and public Passport remain outside this redesign's review scope. PRODUCT.md and the account brief persist the approved direction; DESIGN.md already carries the inherited visual world, with the account-specific roles and intentional local values scheduled for the next documenter handoff. After the bounded fixes, confirm the affected composer, correction navigation/breadcrumb, assessment breadcrumb and desktop recommendation captures; documentation is the planned next handoff.
