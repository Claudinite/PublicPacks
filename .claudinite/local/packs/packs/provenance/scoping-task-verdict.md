## 2026-08-24 · born · Cut the local pack's RULES.md to one trigger and directive per rule (#1315)
- **Reason:** split out of the precondition rule, which carried the scoping question with it; a
  reader can arrive at it without that one.
- **Actor:** @missingbulb (owner).
- **Model:** Claude Opus 5, per the commit trailer.
- **Mechanism:** a RULES.md rule, triggered on "Scoping a task whose verdict is relative to the rest
  of a set".
- **Landed:** #1315 (Closes #1312).

## 2026-10-13 · moved · from missingbulb/Claudinite's local pack to ClaudinitePacks's
- **Reason:** the Node repo is frozen; the rule was rewritten for cn's paths and
  verbs where it named Node machinery.
- **Actor:** @missingbulb (owner), who asked for the move.
- **Model:** Claude.
- **Mechanism:** a RULES.md rule.
