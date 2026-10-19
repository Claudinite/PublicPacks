# actions-storage-forecast — what the worker does

Daily, on a fleet manager, forecasts whether the account that owns the manager repository will run
out of the Actions storage its plan includes before the month ends. There is no `task.md`
because there is no agent: the forecast is arithmetic over two numbers GitHub publishes.

## The run

1. **Read the limit.** The account's plan (`GET /user` for a user, which must be the
   `FLEET_GITHUB_TOKEN` owner; `GET /orgs/<org>` for an organization), mapped to the artifact
   storage GitHub's billing docs list for that plan. The allowance is shared by Actions
   artifacts and Packages.
2. **Read the usage.** The account's billing usage report for this month, and last month during
   the first week: the GB-hours of Actions and Packages storage each repository accrued each
   day. Cache and custom-image storage have allowances of their own and are left out.
3. **Forecast.** What accrued over the month's complete days, plus the least-squares trend of the
   last 7 complete days carried to the month's last day and held at zero. Today counts as
   forecast, since the report reaches it hours later.
4. **Keep the issue.** Forecast over the allowance: one issue,
   `[claudinite] Actions storage will run out this month`, is opened or rewritten with the
   forecast, a chart of the month, the repositories that accrued the most and the probable
   causes. Reopening it reuses the same issue each month. Forecast under: an open one is closed
   with a comment.

No warning is written without both numbers. A plan, a token or a report it cannot read parks the
run for a person, naming what is missing, and the next run waits on that park.

## What the token needs

`FLEET_GITHUB_TOKEN` must belong to the account (a user's plan is visible only to that user) and
carry the **Plan** read permission (a fine-grained token's user permission), or billing read on
the organization.
