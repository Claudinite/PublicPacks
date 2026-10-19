## 2026-10-19 · born · a daily month-end forecast of Actions storage
- **Actor:** @missingbulb (owner): read the account's limit, total its usage, project the month's
  end on the current trend, and warn only with both numbers in hand; a published plan allowance
  counts as the limit.
- **Model:** Claude Opus 5.5 (1M context)
- **Mechanism:** task actions-storage-forecast, code-work only on FLEET_GITHUB_TOKEN. Usage from the
  account's billing usage report, which carries the GB-hours actually billed, including deleted
  artifacts' and Packages'. Limit from the plan name mapped to the billing docs' table. One issue,
  reopened through the tracker lookup, while the forecast is over. Daily, since the report moves
  daily and a week's lag spent most of a month here.
- **Rejected:** summing the repositories' stored artifacts, which misses what already accrued and
  was deleted; projecting minutes, which nobody asked for yet.
