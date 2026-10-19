# repo-health — what the worker does

Weekly, reads what the repository keeps in GitHub Actions storage and cache, and keeps one
issue, `[claudinite] Repo health: Actions storage and cache`, open while something there is off.
There is no `task.md` because there is no agent: each reading is a number against a bar, and the
issue names the probable causes for a person to judge.

## The readings

| Finding | Off when | Judged on |
|---|---|---|
| `artifact-retention` | an `actions/upload-artifact` step under `.github/workflows/` sets no `retention-days`, or more than 7 | private repos |
| `artifact-storage` | the artifacts still stored come to more than 500 MB, GitHub Free's included storage | private repos |
| `cache-size` | the Actions cache holds 8 GB or more of its 10 GB limit | every repo |
| `cache-write-only` | at least 5 cache entries saved this week, and at least half of that week's bytes, were never restored in the day after they were saved | every repo |

Artifacts of a public repository are not billed, so the two artifact readings judge only a
private one. CI duration over time is the basics pack's `ci-performance` task, not this one.

## The issue

- Something off and no open issue: one is filed.
- Something off and the issue open: its body is rewritten to this week's readings, and a comment
  is added only for a finding the issue did not already carry, so a steady problem notifies once.
- Nothing off and the issue open: a comment, and the issue closes.

The issue wears no label. An API read that fails parks the run, since a week judged on a reading
that never arrived would read as healthy.
