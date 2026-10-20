// The actions-storage-forecast code_work: will the account that owns this fleet run out
// of its included Actions storage before the month ends?
//
// Two facts, each from the source that bills it: the account's plan, mapped to the
// storage GitHub publishes as included with it, and the account's own billing usage
// report, which carries the GB-hours every repository accrued each day. Usage is billed
// as GB-hours over the month, so the question is whether what has accrued so far plus
// the recent daily trend, carried to the month's last hour, passes the included amount.
// No warning is written unless both facts were read.
//
// The forecast is pure and exported (`forecast`), so what counts as a coming
// exhaustion is decided in one place and tested there.

import { github, log, fail } from '@claudinite/sdk';
import { makeGh } from './github-api.mjs';

// Included artifact storage by plan, in GB, shared by Actions artifacts and Packages,
// keyed by the API's `plan.name`. GitHub's Actions billing page lists Pro at 1 GB, but
// its plans page (https://docs.github.com/en/get-started/learning-about-github/githubs-plans)
// and a Pro account's own usage alert both give 2 GB, so Pro takes 2.
export const INCLUDED_STORAGE_GB = Object.freeze({
  free: 0.5,
  pro: 2,
  team: 2,
  enterprise: 50,
});

// How many complete days the trend is drawn through.
export const TREND_DAYS = 7;

const DAY_MS = 86400 * 1000;
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

// A line of the usage report that draws on the shared storage allowance: GB-hours of
// Actions or Packages storage. Cache storage and custom images have allowances of
// their own.
export const isSharedStorage = (item) => /gigabyte.?hours?/i.test(item.unitType ?? '')
  && /^(actions|packages)$/i.test(item.product ?? '')
  && !/cache|image/i.test(item.sku ?? '');

/** GB-hours per UTC day, from the report's lines. */
export function storageByDay(items) {
  const days = new Map();
  for (const item of items) {
    if (!isSharedStorage(item)) continue;
    const day = String(item.date).slice(0, 10);
    days.set(day, (days.get(day) ?? 0) + Number(item.quantity ?? 0));
  }
  return days;
}

/**
 * The month's storage forecast at `nowMs`. `days` maps a UTC day to its GB-hours; a day
 * the report does not name accrued nothing. Today is never counted as accrued, since
 * the report reaches it only hours later: it is forecast like the days after it.
 */
export function forecast({ days, includedGB, nowMs }) {
  const now = new Date(nowMs);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const monthStart = Date.UTC(year, month, 1);
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const today = now.getUTCDate();
  const hoursInMonth = daysInMonth * 24;
  const includedGBh = includedGB * hoursInMonth;
  const at = (ms) => days.get(isoDay(ms)) ?? 0;

  const accrued = [];
  for (let d = 1; d < today; d++) accrued.push(at(monthStart + (d - 1) * DAY_MS));

  // A least-squares line through the last TREND_DAYS complete days, carried forward
  // and held at zero: storage that keeps growing keeps growing, and one that empties
  // stops accruing.
  const todayStart = monthStart + (today - 1) * DAY_MS;
  const trend = Array.from({ length: TREND_DAYS }, (_, i) => at(todayStart - (TREND_DAYS - i) * DAY_MS));
  const n = trend.length;
  const meanX = (n - 1) / 2;
  const meanY = trend.reduce((a, b) => a + b, 0) / n;
  const slope = trend.reduce((s, y, x) => s + (x - meanX) * (y - meanY), 0)
    / trend.reduce((s, _, x) => s + (x - meanX) ** 2, 0);
  const projected = [];
  for (let d = today; d <= daysInMonth; d++) {
    projected.push(Math.max(0, meanY + slope * (n - 1 - meanX + (d - today + 1))));
  }

  const accruedGBh = accrued.reduce((a, b) => a + b, 0);
  const totalGBh = accruedGBh + projected.reduce((a, b) => a + b, 0);
  let running = 0;
  const cumulativeGB = [...accrued, ...projected].map((v) => (running += v) / hoursInMonth);
  const crossing = cumulativeGB.findIndex((gb) => gb > includedGB);
  return {
    month: `${year}-${String(month + 1).padStart(2, '0')}`,
    daysInMonth,
    actualDays: accrued.length,
    accruedGB: accruedGBh / hoursInMonth,
    projectedGB: totalGBh / hoursInMonth,
    includedGB,
    includedGBh,
    lastDayGBh: trend[n - 1],
    slopeGBhPerDay: slope,
    cumulativeGB,
    exhaustedOn: crossing === -1 ? null : `${year}-${String(month + 1).padStart(2, '0')}-${String(crossing + 1).padStart(2, '0')}`,
    over: totalGBh > includedGBh,
  };
}

const gb = (x) => `${x.toFixed(2)} GB`;

/** The repositories that accrued the most shared storage this month. */
export function topRepositories(items, month, limit = 5) {
  const byRepo = new Map();
  for (const item of items) {
    if (!isSharedStorage(item) || !String(item.date).startsWith(month)) continue;
    const name = item.repositoryName || '(no repository)';
    byRepo.set(name, (byRepo.get(name) ?? 0) + Number(item.quantity ?? 0));
  }
  return [...byRepo.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

// The one issue this task keeps open while the month is forecast to run out.
export const ISSUE_TITLE = '[claudinite] Actions storage will run out this month';

export function issueBody(f, { account, plan, repos, hoursInMonth, nowIso }) {
  const axis = Array.from({ length: f.daysInMonth }, (_, i) => i + 1).join(', ');
  return [
    `\`${account}\`'s Actions storage (artifacts and Packages) is forecast to reach **${gb(f.projectedGB)}** this month, against the **${gb(f.includedGB)}** its \`${plan}\` plan includes${!f.exhaustedOn ? '' : f.exhaustedOn < nowIso.slice(0, 10) ? `, and already ran out around **${f.exhaustedOn}**` : `, running out around **${f.exhaustedOn}**`}.`,
    `Read by the \`actions-storage-forecast\` task — last ${nowIso}. It rewrites this body each day while the forecast is over, and closes the issue once it is not.`,
    '',
    `Storage bills by the hour, so what accrued stays on the bill even after the artifacts are deleted: **${gb(f.accruedGB)}** has accrued over the month's first ${f.actualDays} days. The rest is the last ${TREND_DAYS} days' trend carried forward (latest day ${(f.lastDayGBh / 24).toFixed(2)} GB held, changing ${(f.slopeGBhPerDay / 24).toFixed(3)} GB a day).`,
    '',
    '```mermaid',
    'xychart-beta',
    `  title "Storage accrued this month, in GB-months (days 1-${f.actualDays} actual, the rest forecast)"`,
    `  x-axis [${axis}]`,
    '  y-axis "GB"',
    `  line [${f.cumulativeGB.map((v) => v.toFixed(3)).join(', ')}]`,
    `  line [${Array(f.daysInMonth).fill(f.includedGB).join(', ')}]`,
    '```',
    '',
    'Repositories that accrued the most this month:',
    '',
    ...repos.map(([name, gbh]) => `- \`${name}\` — ${gb(gbh / hoursInMonth)}`),
    '',
    'Probable causes:',
    '',
    '- artifacts uploaded without a short `retention-days`, which keep the repository default (90 days unless changed)',
    '- a workflow that started uploading a large build on every run, failed and re-run ones included',
    '- Packages storage, which draws on the same allowance',
    '',
    'Deleting stored artifacts stops further accrual but does not refund what already accrued; a budget covers the rest of the month.',
  ].join('\n');
}

async function readJson(gh, path, what) {
  const { status, json } = await gh(path);
  if (status === 401 || status === 403 || status === 404) {
    fail('action', `${what}: GET ${path} returned ${status}. FLEET_GITHUB_TOKEN needs the account's "Plan" read permission (a fine-grained token's user permission, or an organization's billing read)`);
  }
  if (status !== 200) throw new Error(`${what}: GET ${path} returned ${status}`);
  return json;
}

// The account's kind and plan. A user's plan is readable only by that user, so the
// fleet token must be theirs.
async function readPlan(fleetGh, account) {
  const profile = await readJson(fleetGh, `/users/${account}`, 'the account');
  if (profile.type === 'Organization') {
    const org = await readJson(fleetGh, `/orgs/${account}`, 'the organization plan');
    if (!org.plan) fail('action', `FLEET_GITHUB_TOKEN cannot see ${account}'s plan: grant it the organization's "Administration" permission (read)`);
    return { kind: 'org', plan: org.plan.name };
  }
  const me = await readJson(fleetGh, '/user', 'the token owner');
  if (String(me.login).toLowerCase() !== account.toLowerCase()) {
    fail('action', `FLEET_GITHUB_TOKEN belongs to ${me.login}, not ${account}; only ${account} can read its plan`);
  }
  // GitHub leaves `plan` out of the profile for a token without the permission.
  if (!me.plan) fail('action', `FLEET_GITHUB_TOKEN cannot see ${account}'s plan: grant it the account permission "Plan" (read)`);
  return { kind: 'user', plan: me.plan.name };
}

async function readUsage(fleetGh, kind, account, nowMs) {
  const base = kind === 'org' ? `/organizations/${account}` : `/users/${account}`;
  // The trend reaches back into last month during this month's first week.
  const months = new Set([nowMs - TREND_DAYS * DAY_MS, nowMs]
    .map((ms) => `${new Date(ms).getUTCFullYear()}-${new Date(ms).getUTCMonth() + 1}`));
  const items = [];
  for (const [year, month] of [...months].map((m) => m.split('-'))) {
    const json = await readJson(fleetGh, `${base}/settings/billing/usage?year=${year}&month=${month}`, 'the billing usage report');
    items.push(...(json?.usageItems ?? []));
  }
  return items;
}

export async function worker({ repo, secrets }, gh = makeGh(), fleetGh = makeGh({ token: secrets.FLEET_GITHUB_TOKEN }), nowMs = Date.now()) {
  const account = repo.split('/')[0];
  const { kind, plan } = await readPlan(fleetGh, account);
  const includedGB = INCLUDED_STORAGE_GB[plan];
  if (includedGB === undefined) {
    fail('action', `${account}'s plan reads as ${JSON.stringify(plan)}, which has no published storage allowance here; add it to INCLUDED_STORAGE_GB`);
  }
  const items = await readUsage(fleetGh, kind, account, nowMs);
  const seen = new Set(items.map((i) => `${i.product}/${i.sku}/${i.unitType}`));
  log(`${account} (${kind}, ${plan}: ${includedGB} GB included); report lines by product/sku/unit: ${[...seen].join(', ') || 'none'}`);

  const f = forecast({ days: storageByDay(items), includedGB, nowMs });
  log(`${f.month}: accrued ${gb(f.accruedGB)}, forecast ${gb(f.projectedGB)} of ${gb(includedGB)}${f.over ? ` — OVER${f.exhaustedOn ? `, out around ${f.exhaustedOn}` : ''}` : ''}`);

  const open = (await github.listIssues({ state: 'open' }))
    .filter((i) => i.title.trim() === ISSUE_TITLE)
    .sort((a, b) => a.number - b.number)[0];
  const nowIso = new Date(nowMs).toISOString();

  if (!f.over) {
    if (open) {
      await github.createComment({ issue: open.number, body: `${nowIso} — forecast ${gb(f.projectedGB)} of ${gb(includedGB)}, back under; closing.` });
      const { status } = await gh(`/repos/${repo}/issues/${open.number}`, { method: 'PATCH', body: { state: 'closed', state_reason: 'completed' } });
      if (status !== 200) throw new Error(`closing #${open.number} returned ${status}`);
      log(`closed #${open.number}`);
    }
    return;
  }

  const body = issueBody(f, {
    account, plan, repos: topRepositories(items, f.month), hoursInMonth: f.daysInMonth * 24, nowIso,
  });
  // The tracker lookup finds this title in any state, so the fleet holds one such
  // issue for good: reopened each month the forecast goes over, never a second one.
  const number = open?.number ?? (await github.findOrCreateTracker({ title: ISSUE_TITLE })).number;
  const { status } = await gh(`/repos/${repo}/issues/${number}`, { method: 'PATCH', body: { state: 'open', body } });
  if (status !== 200) throw new Error(`writing #${number} returned ${status}`);
  log(`${open ? 'updated' : 'opened'} #${number}`);
}
