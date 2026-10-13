<!-- GENERATED — do not hand-edit; every update rewrites it. Edit a skill's SKILL.md frontmatter. -->
# Skills mounted here, and what loads each one

A skill loads when the session's activity matches its description. A skill that names files
under `force-load-on-file-edits-paths` is also forced for them: a file tool aimed there is held
by the PreToolUse guard until the skill is loaded (the Skill tool, or a Read of its SKILL.md),
and an edit made another way is caught at Stop.

## Before editing these files

| Files | Skill | Pack | Loads when |
|---|---|---|---|
| `**/CLAUDE.md`, `**/.claude/rules/**` | `authoring-agent-docs` | basics | How to write instruction files coding agents follow reliably. Use before writing or editing any Claude instruction doc — a project CLAUDE.md, a convention doc, a routine spec. |
| `.github/workflows/**`, `package.json`, `*/package.json` | `node-test-discovery` | node | Wiring a `node --test` invocation so it actually finds the suite. Loaded for any edit of a workflow or package.json test script. |
| `**/*GENERATED*` | `working-with-generated-files` | basics | Working with a generated file: naming it, changing the generator rather than the file, resolving conflicts by regenerating. Loaded for any edit of a GENERATED file. |
| `**/engine/checks/**`, `**/packs/*/worldRules/**`, `**/packs/*/workRules/**`, `**/packs/*/skills/*/checks.mjs`, `**/declared-checks.json` | `writing-repo-scanning-checks` | basics | How a repo-scanning check picks its files, strips comments, and proves itself silent on real sources. Loaded for any edit of a coded or declared check. |
| `**/*.test.*`, `**/*.spec.*`, `**/*_test.*`, `**/test_*.*`, `**/test/**`, `**/tests/**`, `**/__tests__/**`, `**/spec/**` | `writing-tests` | basics | Practices for writing tests you can trust. Use before writing or changing any test — see-it-fail discipline, snapshot/golden rules, CI-only and heavy-browser tests, fuzzy-metric gating. |

## By activity

| Skill | Pack | Loads when |
|---|---|---|
| `adopt-claudinite` | claudinite-lifecycle | Bootstrap Claudinite into a repo with cn init: packs, questions, workflows, the executor routine, the handover issue. Use when asked to adopt or set up Claudinite. |
| `adopt-pack` | claudinite-lifecycle | Add packs to a repo already running Claudinite: declare, interview, re-vendor, scaffold, land. Use when asked to adopt, add, enable or declare a pack. |
| `bug-investigation` | basics | Pinning down a bug's root cause. Use when investigating a bug report, when a fix didn't hold or a bug recurs, or when a report doesn't reproduce. |
| `ci-performance-evaluation` | basics | Finding where a repo's CI time goes and what is worth fixing. Use when CI feels slow, on a runtime regression, or on a ci-performance finding. |
| `committing` | basics | How a commit is cut: one concern per commit, the issue it references, files staged by name. Use before any git commit. |
| `fetching-from-the-web` | basics | Reading a page or file from the web: exact bytes over a summary, and what a 403 or egress block means. Use before any WebFetch or curl. |
| `file-placement` | basics | Where a file should live: the reference-distance metric and its exemptions. Use before placing, moving or renaming a file, or when reviewing where one lives. |
| `git-github-advanced` | git-github | Git/GitHub procedures beyond the basics task lifecycle. Use for commit layering, recovering a branch after a squash-merge, CI-trigger rules, GitHub Actions gotchas, or merge-relocation traps. |
| `github-actions-scheduling` | git-github | What a GitHub Actions `schedule:` trigger actually guarantees. Use when adding, changing, explaining or debugging anything that runs on a cron in GitHub Actions. |
| `improve-comments` | basics | Improve a repo's own comments as a pass of their own: delete, correct, add the why. Never as a side effect of another change. |
| `merge-to-main` | git-github | Merge the change in front of the owner into main. Use when the owner approves the current branch or PR, or asks to merge or land it into main. |
| `production-retrospective` | basics | Design and file the review that comes back once a larger element has lived in production. Use when designing such an element, or when its merge completes it. |
| `repo-text-sweeps` | basics | Mechanics for grep/sed sweeps, renames, and path relocations across a repo. Use before a bulk find-replace, a rename, or moving files — and after one, to catch silently broken references. |
| `running-the-suite` | packs | Running this repo's test suite: the two commands that cover it, and reading a run's output from a file. Use before any node --test or tools/checks/test.sh. |
| `searching-for-a-tool` | basics | Finding a harness tool by name — the select form for a deferred tool, and what an empty search means. Use before any ToolSearch, and when a search finds nothing. |
| `writing-handover-issues` | basics | How to write a task list a person will execute. Use when filing or editing an issue that asks a human to click, set, register or copy something. |
