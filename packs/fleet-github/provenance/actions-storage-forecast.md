## 2026-10-19 · born · a daily month-end forecast of Actions storage
- **Actor:** @missingbulb (owner): read the account's limit, total its usage, project the month's
  end on the current trend, and warn only with both numbers in hand; a published plan allowance
  counts as the limit.
- **Model:** Claude Opus 5.5 (1M context)
- **Mechanism:** task actions-storage-forecast, code-work only on FLEET_GITHUB_TOKEN. Usage from the
  account's billing usage report, which carries the GB-hours actually billed, including deleted
  artifacts' and Packages'. Limit from the plan name mapped to GitHub's published allowances; Pro
  takes the plans page's 2 GB, which the owner's own Pro alert confirms, over the Actions page's 1 GB. One issue,
  reopened through the tracker lookup, while the forecast is over. Daily, since the report moves
  daily and a week's lag spent most of a month here.
- **Rejected:** summing the repositories' stored artifacts, which misses what already accrued and
  was deleted; projecting minutes, which nobody asked for yet.

## 2026-10-19 · hardened · a hidden plan names the missing permission
- **Source:** Shepherd #1083: the first live run read `/user` with no `plan` field and reported the
  plan as null, as if it were an unknown plan.
- **Actor:** Claude, after the first live run on Shepherd.
- **Model:** Claude Opus 5.5 (1M context)
- **Reason:** GitHub leaves `plan` out of the profile for a token without the Plan permission, so
  the run now parks naming that permission (Administration read for an organization).

## 2026-10-19 · reworded · a run-out date already past reads as past
- **Source:** Shepherd #1085: the first live forecast found missingbulb over since 2026-10-08, which
  the issue would have called "running out around" a day already gone.
- **Actor:** Claude, after the first live run on Shepherd.
- **Model:** Claude Opus 5.5 (1M context)
