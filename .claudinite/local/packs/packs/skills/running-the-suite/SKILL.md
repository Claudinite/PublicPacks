---
name: running-the-suite
description: Running this repo's test suite: the two commands that cover it, and reading a run's output from a file. Use before any node --test or tools/checks/test.sh.
metadata:
  body: guidelines
  usage:
    expect: triggered
  force-load-on-tool-calls:
    - 'Bash.command /\bnode\s+--test\b/'
    - 'Bash.command /tools\/checks\/test\.sh\b/'
---

# Running the suite

- **The whole suite is two commands** - `node --test $(git ls-files '*.test.mjs')` for the Node
  tests, and `CLAUDINITE_CN=<path to cn> sh tools/checks/test.sh` for every pack's Go checks.
  Never a glob in place of the first: `node --test` expands one itself and calls no match a clean
  green, so `packs/*/test/*.test.mjs` runs 9 of 43 files and exits 0, and a pattern matching
  nothing exits 0 having run no test at all. Only `node --test <dir>`, and a literal path carrying
  no `*`, fail outright. (whole-suite-command)
- **Read a run's output from a file** - redirect one run and grep that file for the slice you need;
  never re-run the suite to re-slice unchanged output. (read-runs-output)
