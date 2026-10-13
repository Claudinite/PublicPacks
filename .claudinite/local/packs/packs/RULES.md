# packs

## Standing owner decisions

- **Designing or describing what Claudinite is** — its unit of adoption is the *repository*: it
  pins a `cn`, declares packs in `.claudinite/settings.yaml`, runs its own tasks and validates
  its own state. A per-user or per-machine framing (a plugin, a developer's install) is a
  category error that invents costs the real shape lacks. (designing-describing-claudinite)

- **Having a deferred direction, blocked proposal or status to record** — put it under `docs/`
  and point at it from the issue or PR; never in a pack's `RULES.md`, `SKILL.md`, `README.md` or
  manifest, which ship to every member. (having-deferred-direction)

- **Ending a session on unfinished work** — never compose a hand-off prompt; the owner's opener
  is `continue work on #<n>`. (ending-session-unfinished)

- **Designing a standing mechanism that detects a problem and could act on it** — ship the
  detection alone: a finding names its probable causes, says when that set is open, and
  recommends; the fix stays a gated step, since a mitigation chosen from an inferred cause
  reapplies itself every cycle. (designing-standing-mechanism)

- **Surfacing a number a human reads as a report card** — report a window against the previous
  window; never a monotonic cumulative total, never a figure nothing measures.
  (surfacing-number-human)

- **Lacking a field a report-card number needs** — name it absent in the surface's own note. A
  stated gap is information, a guess is not. (lacking-field-report)

- **Windowing a count** — only where it is built from things that happened inside the window. A
  figure derived from a point-in-time stamp reads a steady population as declining.
  (windowing-count)

- **Classifying an open object by deriving it from other live state** — reconsider once the
  derivation's inputs can change while the object stays open, silently rewriting its history.
  Prefer a marker stamped once at creation and never revisited. (classifying-open-object)

## Working with the owner and the session's tools

- **Answering "why did it fail?"** — lead with the throwing call site: `file:line`, the
  function, and which side enforced it. A narrative that never names the line reads as
  unanswered. (answering-did-fail)

- **Wanting to re-post a question the owner declined** — don't. Take its recommended default, or
  open the question up. (wanting-re-post)

- **Asking about a vague, destructive-sounding instruction** ("remove the entire mechanism") —
  scope the question to the boundary of the vague noun itself, not the consequences of one
  reading of it. (asking-vague-destructive)

- **Writing an `AskUserQuestion`** — phrase it and its options in the requirement's own plain
  terms, not internal jargon, and give an axis the owner treats as independent its own option
  rather than folding it into another. (writing-askuserquestion)

- **Writing the reason an `AskUserQuestion` option gives for itself** — verify it against the
  call sites first: the owner picks the option *for* that reason, so one that proves false is
  this change's to make true, not a new decision to take back. (writing-reason-askuserquestion)

- **Putting a design, restructure or plan to the owner for approval** — render the end state
  whole, every element kind it touches rather than the one easiest to show, and name the
  decisions it took that they never asked about. (putting-design-restructure)

- **Being asked to generalise something, or to review it** — land the conversions or action
  points it unlocks in the same change: a capability ships with its first caller, an analysis
  with its first recommendation applied. (being-asked-generalise)

- **Calling any `claude-code-remote` tool** — one call per intent, ever. Each costs minutes, and
  a call that returns nothing has not failed. (calling-anything-claudecoderemote)

- **Needing to read issues or PRs across several repos in one session** — `add_repo` widens this
  session's GitHub scope; issues are not git refs, so a clone is no substitute.
  (needing-session-read)

- **Reading a tool result the harness saved to a file** — an MCP result is one unbroken line, so
  `Read`'s `offset`/`limit` won't shrink it; parse it with `jq` or `python3 -c
  'json.load(...)'`. A saved Bash result is ordinary lines. (reading-tool-result)

- **Re-waiting on a signal that already failed to move** — read the code that governs when it
  *can* change before waiting a second time on the same premise. (re-waiting-signal)

- **Replying to an owner comment that raises more than one claim** — answer every claim in that
  first reply, including the one you intend to push back on. (answering-every-claim)

- **Repeating a design doc's stated architectural rationale** — verify each claimed ground
  against the current code first; a later `docs/design-record.md` row may have amended it.
  (repeating-design-docs)

- **An owner reversing a standing decision** — purge every place that still states the old
  decision (docs, comments, code defaults) and record the new one where a future session reads
  it (in the engine, a `docs/design-record.md` row that amends the old). Answering the prompting
  question alone is not the fix. (owner-reversing-standing)

- **A Bash command refused as naming git (or a computed argument) "too complex to verify" inside
  a worktree-isolated agent** — drop straight to the plain, literal form; a loop, heredoc or
  `$(...)` around the same call fails the same way. (bash-command-refused)

- **Bundling a file write into a Bash command that also runs a guarded call** (`go test`, `git
  commit`, `curl`) — split them: a PreToolUse guard reads the whole command string, heredoc data
  included, and blocks the call before any of it runs, so the write is lost.
  (bundling-write-guarded)

- **Calling `EnterWorktree` in an unattended session** — nobody is present to approve it, so it
  is denied after about a minute; use `git worktree add` or `git checkout -b` instead.
  (calling-enterworktree-unattended)

- **Finishing a fan-out of subagents** — clear its wreckage before reporting done: stop the
  waiters, confirm each child's commits are on your branch, and remove its worktree and branch.
  (finishing-fan-out)

- **Asserting why a system behaved a certain way** — read the primary evidence first: the
  issue's own body and comments, or the enforcing source line. A verdict inferred from structure
  or memory alone has shipped as a fix for a bug that wasn't there. (asserting-system-behaved)

## Checks and capabilities

- **Starting a new Claudinite capability** — decide its home before the first file: `cn` code, a
  pack the engine carries (`cn/*/pack`), a canon pack in ClaudinitePacks, or a member's local
  pack. Getting it wrong costs a move-and-rewrite across repos. (starting-new-claudinite)

- **Naming a function** — a `<verb><noun>` name reads as doing that verb to that noun, so give a
  reader a verb that says it reads (`readWindowCommits`) and never lead with a noun that is also
  a verb (`commitFiles`). (naming-function)

- **Choosing how a declared field spells two opposite states** — never let them differ by one
  keystroke (`["none"]` vs. no key); a reader without the schema must still tell them apart.
  (choosing-declared-field)

- **Adding a legacy tolerance for a rename whose holders are files this session can read** —
  count them and rename them in the same change instead; a dual read is scaffolding where the
  old spelling may have one holder. (legacy-tolerance-holder-count)

- **Adding a legacy tolerance in code** — file the issue that removes it first, then put
  `@legacy-tolerance advisory:<rule-id|none> retire:#<issue>` in a comment directly above the
  declaration; `advisory:none` claims no member file can hold the old shape, so that issue must
  name what does read the holder. (legacy-tolerance-marker)

- **Creating the artifact a check will demand** — create it before the action it gates, not
  after. (creating-artifact-check)

- **Writing the exemption branch of a check** — read its evidence from the tracked tree, never
  the change's own files: the change an exemption spares is usually one that never touches the
  file carrying the evidence. (writing-exemption-branch)

- **Writing a check that fires on a removed line** (`forbidRemovedLinesMatching`) — it cannot
  see a deleted file: removing one export fires, deleting the whole file is silent. Guard the
  deletion separately. (writing-check-fires)

- **Wanting a boundary enforced in test files** — never a `forbidReferences` barrier, whose
  scanner drops every `*.test.mjs` first; express it as a line-match check, which does see
  tests. (wanting-boundary-enforced)

## The engine and what reaches members

- **Writing a path, regex or command a pack uses against pack files** — make the
  `.claudinite/(shared|local)/` prefix optional in the pattern, or resolve from the pack's own
  directory: the same code runs under `packs/<id>/` in this repo's tests and under the mount in
  a member. (writing-path-regex)

- **Adding a key to the declared-check vocabulary** — an older `cn` drops the key and runs the
  rest of the declaration, so write the declaration correct without it, or raise the pack's
  `minEngineVersion` to the first `cn` that reads it. (adding-key-declared)

- **Renaming a pack's config key that members write into `settings.yaml`** — every reader
  resolves the new key and every legacy spelling, permanently; nothing rewrites a member's
  settings for a pack. (renaming-pack-config)

- **Extending what a pack's copied stub reads** — make the new config key optional, fail the run
  when it is declared-but-unset, and let declaring it trigger a staleness check: stubs are
  copied at adoption and never re-copied. (extending-copied-stub)

- **Excluding files from the vendored archive by pattern** — whitelist any operational file that
  matches by path, and pin it with a test against the real shelf; a published pack version is
  immutable, so a file it dropped stays missing for every member holding it.
  (excluding-files-vendor)

- **Testing that an operational file still vendors** — assert the whole containing directory,
  not the one file that broke. (testing-operational-file)

- **Judging whether a migration chain's link is still outstanding** — read the world its exit
  condition names, never the link's own issue, whose status lags the world.
  (judging-whether-migration)

- **Writing generated content into a size-capped GitHub field** — budget it in two tiers: an
  always-complete compact summary, plus detail rationed to a byte budget with an explicit
  omitted-count; an unbounded write fails at ~64KB. (writing-generated-content)

- **Writing a generated title whose content scales with a list** — collapse the list to a count
  and keep per-item detail in the body. (writing-generated-title)

- **Corroborating a theory with a signal already known unreliable** — don't; find an independent
  one. (corroborating-theory-signal)

- **A script written for one execution context** — audit every script's environment assumptions
  (a real `GITHUB_TOKEN`, `gh`/`curl` reachability) whenever its caller's context changes; every
  script built on the old assumption fails the same way. (script-written-execution)

- **Carrying a version** (`1.61004.1`) — keep it string-typed everywhere and compare it part by
  part; `'60820.10'` and `'60820.1'` are different versions and the same float.
  (carrying-dotted-version)

- **Changing the format of an identifier members compare for order** — choose the new shape so
  every old value sorts below every new one, and the change needs no migration and no tolerance.
  (changing-format-identifier)

- **Designing text that instructs a model to echo an exact string** — state the instruction
  first, have it disclaim itself as instruction-not-payload, and put the literal string once,
  last; never refer to it anaphorically. (designing-text-instructs)

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

- **Writing a backstop, fallback lane or sweep whose healthy run finds nothing** — give it a
  term that asks its own question, calling the rules its worker calls rather than restating
  their clocks; a cadence alone files an item and a closed receipt every period to say all is
  well. (writing-backstop-fallback)

- **Scoping a task whose verdict is relative to the rest of a set** — the gate is not the scope:
  newness gates, and the full set stays the scope. (scoping-task-verdict)

- **Writing a task whose output is a regenerated file** — read prior state from the fetched base
  branch it lands on, never local HEAD, and write nothing when only the stamp changed.
  (writing-task-output)

- **Decomposing a pipeline into chained tasks** — chain stages by preconditions that each
  re-derive the world's actual state, never by parameters passed forward, so an interrupted run
  self-heals on the next pick. (decomposing-pipeline-chained)

- **Passing a diagnostic verdict out of a subprocess that may be killed at its timeout** — write
  it to stdout or stderr as you go, never a file written at exit; printed output survives a
  kill. (passing-diagnostic-verdict)

- **Choosing a recurring task's `expected_outcome`** — prefer `amend_existing_or_create_new_pr`
  wherever each run recomputes the whole answer, so one pull request accumulates the review;
  `supersede_existing_pr` files a fresh one per cycle. (choosing-recurring-tasks)

- **Re-delivering a scheduled recompute onto its own branch** — compare the branch's remote tree
  with the one you built and push nothing when they match; a force-push gives the PR a new head
  and discards every check already run on it. (re-delivering-scheduled)

## Proving a change

- **Needing a pack, task, skill or check name in a test** — use the invented `acme-pack`,
  `acme-task`, `acme-skill`; a pack's own tests name its own elements freely, and a line whose
  subject really is a real entity ends `@real-entity <why>` in a comment.
  (test-fixtures-use-fake-entities)

- **Testing a fail-soft step** — assert the positive effect (the output IS emitted), never a
  clean exit, which fail-soft makes meaningless. (testing-fail-soft)

- **Asserting a mid-run invariant** — capture it at the moment the state holds; by the run's end
  normal convergence has cleared the evidence. (asserting-mid-run)

- **Writing a conformance test over the tree or the shelf** — gather every failure and report
  once (`t.Errorf`, not `t.Fatal`, inside the loop), so one change touching five places costs
  one red-green cycle. (writing-conformance-test)

- **Writing a regression test that pins a policy or convention** — assert the behaviour the
  decision requires, never a sentence quoted from a doc. (writing-regression-test)

- **Deriving an answer by walking git history** — guard explicitly against a shallow clone and
  fail loudly; otherwise it answers from the clone's own horizon. (test-derives-answer)

- **Changing the guidance that produced a bad artifact** — prove the rewrite by reverting that
  artifact and having a fresh subagent redo the task against the new text.
  (changing-guidance-produced)

- **Restoring source after a deliberate see-it-fail mutation** — stage your own edits to that
  file first, then `git checkout -- <file>` at the moment of mutating, never a backup taken
  earlier. (restoring-source-deliberate)

- **Surveying whether something exists in the tree** — a code-search hit is evidence, a miss is
  not; survey by reading each file. (surveying-whether-something)

- **Documenting or relying on a named knob** — grep for the code that reads it and the code that
  writes it first; the corpus naming it is not evidence it exists. (documenting-relying-named)

- **Deleting a writer** — mark its series historical in the same change; its rows otherwise keep
  counting plausibly until retention ages them out. (deleting-writer)

- **Renaming an entity** — don't change historical records. (renaming-entity)

- **Sweeping a rename across several PRs** — a file added after the sweep starts can reintroduce
  the retired name as a comparison key, failing silently; re-grep at the end.
  (sweeping-rename-mid)

- **Renaming a word that is also stored data** (a counter key, a wire word, a label) — rename it
  on the decode side too, or old rows decode to null. (renaming-word-also)

- **A second rename of one name** — map every legacy spelling straight to today's, never
  chaining one normalization onto the last. (second-rename-name)

- **Writing a "this period is covered" marker** — write it strictly after the durable effect it
  guards, and only for the declined case; a go verdict's coverage is the item it created.
  (writing-period-covered)

- **Verifying a bulk file-move or rewrite preserved content** — compare a structural count
  before and after (`func Test` or `test(` calls across the touched files); a truncated test
  file still passes. (verifying-bulk-file)

- **Proving a sweep left a Node module's behaviour unchanged** — read the before and after in
  separate processes; the module cache serves the pre-rewrite module in-process.
  (proving-sweep-left)

## Editing, branching and merging

- **Rewriting a JSON or YAML target nested inside an array within an entry** — parse and rewrite
  structurally, preserving key order and sibling fields; an anchored regex cannot cross the
  nested closing bracket. (json-target-nested)

- **Returning to a branch that waited** — after `git fetch`, re-verify the premise unasked: say
  whether the problem is still there and what survives. (returning-branch-waited)

- **Merging a PR that sat open across many `main` commits** — check its current
  `mergeable_state`, not an old green run; a move on `main` can make it conflict with no new run
  failing. (merging-pr-has)

- **A PR head showing no check runs at all** — read its mergeability first: GitHub starts no
  `pull_request` run while the branch conflicts with its base. (pr-head-no-checks)

- **Resolving a conflict in a `declared-checks.json`** — take the base's whole file and
  re-append your one entry; under `rebase` the base side is `--ours`.
  (resolving-conflict-declared)

- **Scoping a fix to the lines a change added when it also moved files** — drop the pathspec:
  narrowed to the destination, `-M` has no source to pair and reports every moved line as added.
  (scoping-fix-added-lines)

- **Rebasing a branch that moved files onto a `main` that edited them** — git raises the
  conflict at the old path only, so resolving it for the move drops `main`'s hunks; audit them
  before pushing. (rebasing-branch-moved)

- **Having work that completes or corrects an open PR** — put it on that PR's branch; splitting
  gives the owner two gates for one decision. (having-work-completes)

- **Wanting to combine two PRs** — update the one you keep and close the other; never push one's
  branch onto the other's base, since GitHub marks a PR merged once its head is reachable.
  (wanting-combine-prs)

- **Being asked "should no X decide this?"** — it questions whether the decision exists at all;
  never answer by moving the knob one rung out. (being-asked-should)

- **Facing a retry across a call whose outcome you cannot observe** — check whether declining to
  retry removes the uncertainty before building dedup machinery. (facing-retry-across)

- **Writing a regex import-path rewriter for a bulk move** — anchor to real import syntax, never
  a bare `from '...'` across the whole text; fixtures holding import syntax as data get
  corrupted. In Go, prefer `gofmt -r` or `go` tooling. (writing-regex-import)

- **Verifying a sweep that rewrote citations** — read every rewritten site, not just the exit
  grep, which proves the old token gone, never the replacement right. (verifying-sweep-rewrote)
