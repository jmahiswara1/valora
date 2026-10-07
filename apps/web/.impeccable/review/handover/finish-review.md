## verdict

1. **Loaded history on paging failure — resolved.** The refreshed pagination desktop/mobile captures retain the loaded activity row beside an actionable retry. The revision-error captures retain the private approved proposal and shipment revision beside the failed-page retry. The Admin pagination captures retain the agreement and loaded proposal history beside its retry. Source in timeline.tsx/admin.tsx renders cached history during transient failures and uses fetchNextPage for isFetchNextPageError; privateReadDenied and active grant gating still hide denied or expired private content.

All fourteen supplied original/error captures were reopened and are valid for their declared scope. No regression introduced by this fix was observed. The supplied logs record 20 mock UI tests and 180 browser regression tests passed; no tests or detector were rerun by this reviewer.

## remaining

Clear. Ship applies to the scored fix. Backend enforcement remains outside this visual verdict.

disposition: ship
