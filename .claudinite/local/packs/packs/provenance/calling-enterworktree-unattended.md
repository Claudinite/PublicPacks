## 2026-09-07 · born · converted from references.md (RULES-78)
- **Reason:** Growth-extract over a captured session, issue #1672, 2026-09-06 (#1863):
  `EnterWorktree` blocked ~68.3s inside a worktree-isolated agent before returning "Denied by user,"
  which forced a manual `git worktree`/`git checkout -b` fallback — a wall every unattended
  session hits, since nobody is present to answer the confirmation it waits on.
- **Mechanism:** prose
- **Retire when:** Retire the rule if `EnterWorktree` stops requiring interactive confirmation, or
  an unattended session gains a way to answer it.

## 2026-10-13 · moved · from missingbulb/Claudinite's local pack to ClaudinitePacks's
- **Reason:** the Node repo is frozen; the rule was rewritten for cn's paths and
  verbs where it named Node machinery.
- **Actor:** @missingbulb (owner), who asked for the move.
- **Model:** Claude.
- **Mechanism:** a RULES.md rule.
