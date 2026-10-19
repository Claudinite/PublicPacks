## 2026-10-19 · born · a weekly read of Actions storage and cache
- **Source:** Engine's Actions storage filled the account's monthly allowance: 293 artifacts, 17 GB,
  kept the 90-day default (ClaudiniteEngine #372); and the release's cache restore had missed every
  run since #339 (#374).
- **Actor:** @missingbulb (owner), asking for a weekly repo health check and choosing all four
  readings.
- **Model:** Claude Opus 5.5 (1M context)
- **Mechanism:** task repo-health, code-work only on the member's existing scheduler, so no workflow
  is added to any member. One open issue while something is off, closed once nothing is; a comment
  only for a newly-off finding.
- **Rejected:** a CI-duration reading, since basics' ci-performance already compares each workflow's
  weekly median; artifact readings on public repos, whose storage is not billed; the engine's
  tracker actions, which keep a closed record where this needs an open issue a person sees.
- **Retire when:** GitHub alerts on these itself before the allowance is spent.
