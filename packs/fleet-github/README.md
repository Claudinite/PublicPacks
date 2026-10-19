# fleet-github — the GitHub account a fleet bills to

For a fleet manager: the account-wide view a single repository cannot have. GitHub bills Actions
to the account that owns the repositories, so whether the fleet is about to exhaust what its plan
includes is a question about every repository at once, answered from the account's own billing
report rather than from any one repository's workflows.

Declare it on the fleet manager repository. It carries no rules, skills or checks.

## Task

`actions-storage-forecast`, daily: forecasts the account's Actions storage to the end of the
month against its plan's allowance, and keeps one issue open while it would run out. Its
[README](tasks/actions-storage-forecast/README.md) lists what it reads and what the token needs.
