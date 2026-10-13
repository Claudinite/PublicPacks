## 2026-09-15 · born · converted from references.md (RULES-89)
- **Reason:** #1890: the roles-as-folders extraction expressed its `contract`/`items`/stage boundary
  as a `forbidReferences` barrier, then found the cleanup unenforced — `isTestFile` in
  `engine/checks/helpers/reference-scanning.mjs` filters `*.test.[cm]js` out of `scannable` for
  every edge, by design (a test references what it tests). The exclusion is scanner-wide, not
  per-rule, so no carve-out or config reaches it and the barrier reads green over a surface it never
  opened; the same boundary expressed as a line match did see the tests.
- **Mechanism:** prose
- **Retire when:** Retire the rule if the reference scanner gains a per-edge opt-in for test files.

## 2026-10-13 · moved · from missingbulb/Claudinite's local pack to ClaudinitePacks's
- **Reason:** the Node repo is frozen; the rule was rewritten for cn's paths and
  verbs where it named Node machinery.
- **Actor:** @missingbulb (owner), who asked for the move.
- **Model:** Claude.
- **Mechanism:** a RULES.md rule.
