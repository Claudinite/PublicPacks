## 2026-09-06 · born · converted from references.md (RULES-73)
- **Reason:** #1672's capture (2026-09-03T22:31–23:01): nine Bash commands refused by the
  worktree-isolation guard over ~29 minutes, each retried as a different clever wrapper — a `for`
  loop, two heredocs, and three shapes of computed substitution (`$(git ls-files ...)`, `$(cat
  ...)`, `xargs -a`) — around the same git call the guard had already refused, before the run gave
  up varying the wrapper and used a plain form.
- **Mechanism:** prose
- **Retire when:** Retire the rule only if the guard starts naming the literal form it would accept.

## 2026-10-13 · moved · from missingbulb/Claudinite's local pack to ClaudinitePacks's
- **Reason:** the Node repo is frozen; the rule was rewritten for cn's paths and
  verbs where it named Node machinery.
- **Actor:** @missingbulb (owner), who asked for the move.
- **Model:** Claude.
- **Mechanism:** a RULES.md rule.
