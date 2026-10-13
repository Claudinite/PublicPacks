# packs

## The engine and what reaches members

- **Writing a path, regex or command a pack uses against pack files** — make the
  `.claudinite/(shared|local)/` prefix optional in the pattern, or resolve from the pack's own
  directory: the same code runs under `packs/<id>/` in this repo's tests and under the mount in
  a member. (writing-path-regex)

- **Extending what a pack's copied stub reads** — make the new config key optional, fail the run
  when it is declared-but-unset, and let declaring it trigger a staleness check: stubs are
  copied at adoption and never re-copied. (extending-copied-stub)

## Scheduled tasks

- **A task filing an issue no person will act on** (a tracker, a machine record) — file it
  CLOSED and labelled, set both on every write so a reopened one converges, and find it by that
  label rather than paging closed history. (filing-issue-person)

- **Choosing a task's cadence** — take it from how often its signal actually moves; a movement
  signal is read since the task's newest run started, so a weekly task still sees the whole
  week. (choosing-tasks-cadence)

- **A precondition that holds nearly every night** — daily buys noise, not freshness, and spends
  an agent session each time; prefer weekly where the work isn't latency-sensitive.
  (precondition-fires-nearly)

- **A precondition signal that is true most days** — let it only *widen* an already-triggered
  run, never trigger one. (precondition-signal-true)

- **Scoping a task whose verdict is relative to the rest of a set** — the gate is not the scope:
  newness gates, and the full set stays the scope. (scoping-task-verdict)

- **Writing a task whose output is a regenerated file** — read prior state from the fetched base
  branch it lands on, never local HEAD, and write nothing when only the stamp changed.
  (writing-task-output)

- **Decomposing a pipeline into chained tasks** — chain stages by preconditions that each
  re-derive the world's actual state, never by parameters passed forward, so an interrupted run
  self-heals on the next pick. (decomposing-pipeline-chained)

- **Choosing a recurring task's `expected_outcome`** — prefer `amend_existing_or_create_new_pr`
  wherever each run recomputes the whole answer, so one pull request accumulates the review;
  `supersede_existing_pr` files a fresh one per cycle. (choosing-recurring-tasks)

## Proving a change

- **Proving a sweep left a Node module's behaviour unchanged** — read the before and after in
  separate processes; the module cache serves the pre-rewrite module in-process.
  (proving-sweep-left)

## Editing, branching and merging

- **Resolving a conflict in a `declared-checks.json`** — take the base's whole file and
  re-append your one entry; under `rebase` the base side is `--ours`.
  (resolving-conflict-declared)
