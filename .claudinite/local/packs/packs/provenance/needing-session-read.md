## 2026-08-27 · born · Claudinite growth: extract lessons (#1406)
- **Source:** the growth-extract run over the window in #1402; both rules found live on #1119.
- **Reason:** issues are not git refs, so there is no `git clone` substitute for reading them across
  repositories.
- **Actor:** @missingbulb (owner).
- **Model:** Claude, per the commit trailer.
- **Mechanism:** a RULES.md rule, triggered on "Needing a session to read issues or PRs across
  several repos in one pass".
- **Landed:** #1406 (Refs #1402).

## 2026-10-13 · moved · from missingbulb/Claudinite's local pack to ClaudinitePacks's
- **Reason:** the Node repo is frozen; the rule was rewritten for cn's paths and
  verbs where it named Node machinery.
- **Actor:** @missingbulb (owner), who asked for the move.
- **Model:** Claude.
- **Mechanism:** a RULES.md rule.
