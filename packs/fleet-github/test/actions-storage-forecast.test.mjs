// The actions-storage-forecast task's forecast and the one issue it keeps. Whether the
// month is called over decides whether a person is warned, so it is pure code tested
// here rather than inferred from a live account.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installSdk } from '../../../tools/test/sdk-stand-in.mjs';

let openIssues = [];
const sdk = installSdk({
  params: { pack: 'fleet-github', task: 'actions-storage-forecast' },
  answers: {
    'github.listIssues': () => openIssues,
    'github.createComment': () => ({ id: 1 }),
    'github.findOrCreateTracker': () => ({ number: 41, created: false, duplicates: 0 }),
  },
});
const {
  forecast, storageByDay, isSharedStorage, topRepositories, worker, ISSUE_TITLE, TREND_DAYS,
} = await import('../tasks/actions-storage-forecast/worker.mjs');

// Noon on the 19th of a 31-day month.
const NOW = Date.parse('2026-10-19T12:00:00Z');
const day = (iso) => iso;
// `gb` GB held all day, every day from `from` to `to` (ISO dates), as a day map.
function held(gb, from, to, days = new Map()) {
  for (let t = Date.parse(from); t <= Date.parse(to); t += 86400000) {
    days.set(new Date(t).toISOString().slice(0, 10), gb * 24);
  }
  return days;
}

test('a level that lands exactly on the allowance is not over; a hair above it is', () => {
  const level = forecast({ days: held(1, '2026-10-01', '2026-10-18'), includedGB: 1, nowMs: NOW });
  assert.equal(level.actualDays, 18);
  assert.ok(Math.abs(level.projectedGB - 1) < 1e-9, `projected ${level.projectedGB}`);
  assert.equal(level.over, false);
  const above = forecast({ days: held(1.001, '2026-10-01', '2026-10-18'), includedGB: 1, nowMs: NOW });
  assert.equal(above.over, true);
  assert.equal(above.exhaustedOn, '2026-10-31');
});

test('today is forecast, never accrued, whatever the report already says about it', () => {
  const days = held(1, '2026-10-01', '2026-10-18');
  days.set(day('2026-10-19'), 500 * 24);
  const f = forecast({ days, includedGB: 1, nowMs: NOW });
  assert.equal(f.over, false);
  assert.ok(Math.abs(f.accruedGB - 18 / 31) < 1e-9);
});

test('a growing week is carried forward as growth, and names the day it runs out', () => {
  const days = held(0.2, '2026-10-01', '2026-10-11');
  // 1, 2, ... 7 GB held over the last seven complete days.
  for (let i = 0; i < TREND_DAYS; i++) days.set(`2026-10-${12 + i}`, (i + 1) * 24);
  const f = forecast({ days, includedGB: 2, nowMs: NOW });
  assert.ok(Math.abs(f.slopeGBhPerDay - 24) < 1e-9);
  assert.equal(f.over, true);
  // Accrued through the 18th: (11 × 0.2 + 28) GB-days = 30.2 GB-days, under 62.
  // Forecast days hold 8, 9, 10, 11, … GB: the 19th to the 21st add 27, reaching 57.2;
  // the 22nd adds 11 and passes 62.
  assert.equal(f.exhaustedOn, '2026-10-22');
});

test('a shrinking trend is held at zero rather than accruing negative storage', () => {
  const days = new Map();
  for (let i = 0; i < TREND_DAYS; i++) days.set(`2026-10-${12 + i}`, (TREND_DAYS - i) * 24 * 10);
  const f = forecast({ days, includedGB: 50, nowMs: NOW });
  assert.ok(f.cumulativeGB.every((v, i, a) => i === 0 || v >= a[i - 1]));
  assert.ok(Math.abs(f.projectedGB - f.cumulativeGB.at(-1)) < 1e-9);
});

test('in the first week the trend reaches into last month, but only this month accrues', () => {
  const early = Date.parse('2026-11-03T12:00:00Z');
  const f = forecast({ days: held(3, '2026-10-25', '2026-11-02'), includedGB: 2, nowMs: early });
  assert.equal(f.actualDays, 2);
  assert.ok(Math.abs(f.accruedGB - (2 * 3 * 24) / (30 * 24)) < 1e-9);
  assert.ok(Math.abs(f.projectedGB - 3) < 1e-9);
  assert.equal(f.over, true);
});

const line = (over) => ({
  date: '2026-10-05', product: 'Actions', sku: 'actions_storage', unitType: 'GigabyteHours',
  quantity: 24, repositoryName: 'acme/member', ...over,
});

test('only artifact and Packages storage draws on the shared allowance', () => {
  assert.equal(isSharedStorage(line()), true);
  assert.equal(isSharedStorage(line({ product: 'Packages', sku: 'packages_storage' })), true);
  assert.equal(isSharedStorage(line({ sku: 'actions_cache_storage' })), false);
  assert.equal(isSharedStorage(line({ sku: 'actions_custom_image_storage' })), false);
  assert.equal(isSharedStorage(line({ unitType: 'Minutes', sku: 'actions_linux' })), false);
  const days = storageByDay([line(), line({ repositoryName: 'acme/other' }), line({ sku: 'actions_cache_storage' })]);
  assert.deepEqual([...days], [['2026-10-05', 48]]);
});

test('the repositories are ranked by what they accrued this month only', () => {
  const ranked = topRepositories([
    line({ repositoryName: 'acme/small', quantity: 5 }),
    line({ repositoryName: 'acme/big', quantity: 50 }),
    line({ repositoryName: 'acme/big', quantity: 999, date: '2026-09-30' }),
  ], '2026-10');
  assert.deepEqual(ranked, [['acme/big', 50], ['acme/small', 5]]);
});

// The fleet token's side of the API, scripted.
function fleet({ plan = 'pro', login = 'acme', usage = [], usageStatus = 200 } = {}) {
  const read = [];
  const gh = async (path) => {
    read.push(path);
    if (path === '/users/acme') return { status: 200, json: { login: 'acme', type: 'User' } };
    if (path === '/user') return { status: 200, json: { login, plan: { name: plan } } };
    if (path.startsWith('/users/acme/settings/billing/usage')) return { status: usageStatus, json: { usageItems: usage } };
    return { status: 404, json: null };
  };
  return { gh, read };
}
function job() {
  const writes = [];
  const gh = async (path, { method = 'GET', body } = {}) => {
    writes.push({ method, path, body });
    return { status: 200, json: {} };
  };
  return { gh, writes };
}
const usageHeld = (gb) => [...held(gb, '2026-10-01', '2026-10-18')].map(([date, q]) => line({ date, quantity: q }));
const bag = { repo: 'acme/manager', secrets: { FLEET_GITHUB_TOKEN: 't' } };
const comments = () => sdk.calls.filter((c) => c.method === 'github.createComment');

test('a forecast over the allowance opens the one titled issue with the forecast and its repositories', async () => {
  openIssues = [];
  sdk.calls.length = 0;
  const j = job();
  await worker(bag, j.gh, fleet({ usage: usageHeld(3) }).gh, NOW);
  assert.deepEqual(sdk.calls.filter((c) => c.method === 'github.findOrCreateTracker').map((c) => c.args.title), [ISSUE_TITLE]);
  assert.deepEqual(j.writes.map((w) => [w.method, w.path, w.body.state]), [['PATCH', '/repos/acme/manager/issues/41', 'open']]);
  assert.match(j.writes[0].body.body, /3\.00 GB\*\* this month, against the \*\*2\.00 GB\*\*/);
  assert.match(j.writes[0].body.body, /`acme\/member` — 1\.74 GB/);
});

test('an open issue is rewritten while over, and closed once the forecast is back under', async () => {
  openIssues = [{ number: 7, title: ISSUE_TITLE, state: 'open', labels: [], body: '' }];
  sdk.calls.length = 0;
  const over = job();
  await worker(bag, over.gh, fleet({ usage: usageHeld(3) }).gh, NOW);
  assert.deepEqual(over.writes.map((w) => [w.path, w.body.state]), [['/repos/acme/manager/issues/7', 'open']]);
  assert.equal(sdk.calls.some((c) => c.method === 'github.findOrCreateTracker'), false);

  const under = job();
  await worker(bag, under.gh, fleet({ usage: usageHeld(1) }).gh, NOW);
  assert.deepEqual(under.writes.map((w) => w.body.state), ['closed']);
  assert.equal(comments().length, 1);

  openIssues = [];
  const quiet = job();
  await worker(bag, quiet.gh, fleet({ usage: usageHeld(1) }).gh, NOW);
  assert.deepEqual(quiet.writes, []);
});

test('no warning without both numbers: an unreadable limit or usage parks the run', async () => {
  openIssues = [];
  const cases = [
    [fleet({ usageStatus: 403, usage: usageHeld(5) }), /billing usage report.*403/],
    [fleet({ login: 'someone-else', usage: usageHeld(5) }), /belongs to someone-else/],
    [fleet({ plan: 'acme-plan', usage: usageHeld(5) }), /"acme-plan"/],
  ];
  for (const [f, message] of cases) {
    const j = job();
    await assert.rejects(worker(bag, j.gh, f.gh, NOW), (e) => e.triage === 'action' && message.test(e.message));
    assert.deepEqual(j.writes, []);
  }
});

test('the first week reads last month\'s report too', async () => {
  const f = fleet();
  openIssues = [];
  await worker(bag, job().gh, f.gh, Date.parse('2026-11-03T12:00:00Z'));
  assert.deepEqual(f.read.filter((p) => p.includes('billing')), [
    '/users/acme/settings/billing/usage?year=2026&month=10',
    '/users/acme/settings/billing/usage?year=2026&month=11',
  ]);
});
