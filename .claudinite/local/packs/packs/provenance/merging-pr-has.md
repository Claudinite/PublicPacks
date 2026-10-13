## 2026-08-27 · born · Claudinite growth: extract lessons (#1406)
- **Source:** the growth-extract run over the window in #1402; both rules found live on #1119.
- **Reason:** a six-day-old green pull request had gone `dirty` after 52 commits including a
  directory move, with no new run ever failing.
- **Actor:** @missingbulb (owner).
- **Model:** Claude, per the commit trailer.
- **Mechanism:** a RULES.md rule, triggered on "Merging a PR that has sat open across many main
  commits".
- **Landed:** #1406 (Refs #1402).

## 2026-10-13 · moved · from missingbulb/Claudinite's local pack to ClaudinitePacks's
- **Reason:** the Node repo is frozen; the rule was rewritten for cn's paths and
  verbs where it named Node machinery.
- **Actor:** @missingbulb (owner), who asked for the move.
- **Model:** Claude.
- **Mechanism:** a RULES.md rule.
