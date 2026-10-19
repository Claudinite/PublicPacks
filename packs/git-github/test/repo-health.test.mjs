// The repo-health task's verdicts and the one issue it keeps. What counts as off
// decides whether a person is asked to look, so it is pure code tested here rather
// than inferred from a live repo's storage.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installSdk } from '../../../tools/test/sdk-stand-in.mjs';

let openIssues = [];
const sdk = installSdk({
  params: { pack: 'git-github', task: 'repo-health' },
  answers: {
    'github.listIssues': () => openIssues,
    'github.createComment': () => ({ id: 1 }),
    'github.findOrCreateTracker': () => ({ number: 41, created: false, duplicates: 0 }),
  },
});
const {
  scanWorkflows, judge, worker, readKinds, ISSUE_TITLE,
  ARTIFACT_BYTES_LIMIT, CACHE_LIMIT_BYTES, CACHE_NEAR_LIMIT, WRITE_ONLY_MIN_ENTRIES, MAX_RETENTION_DAYS,
} = await import('../tasks/repo-health/worker.mjs');

const NOW = Date.parse('2026-10-19T12:00:00Z');
const daysAgo = (d) => new Date(NOW - d * 86400 * 1000).toISOString();
const MB = 1024 ** 2;

const workflow = (steps) => `name: acme
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
${steps}
  other:
    runs-on: ubuntu-latest
    steps:
      - run: echo
`;

test('an upload with no retention-days, or one above the bar, is found at its line', () => {
  const text = workflow(`      - uses: actions/checkout@v4
      - name: keep dist
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist
      - uses: actions/upload-artifact@v4
        with:
          name: logs
          retention-days: 30
      - uses: actions/upload-artifact@v4
        with:
          name: handoff
          retention-days: ${MAX_RETENTION_DAYS}
      - uses: "actions/upload-artifact@v4"
        with:
          retention-days: \${{ inputs.days }}`);
  const found = scanWorkflows([{ path: '.github/workflows/acme.yml', text }]);
  assert.deepEqual(found, [
    { path: '.github/workflows/acme.yml', line: 9, days: null },
    { path: '.github/workflows/acme.yml', line: 13, days: 30 },
  ]);
});

test('a retention-days in the next step does not cover an upload that sets none', () => {
  const text = workflow(`      - uses: actions/upload-artifact@v4
        with:
          name: dist
      - uses: acme/other@v1
        with:
          retention-days: 1`);
  assert.equal(scanWorkflows([{ path: 'w.yml', text }]).length, 1);
});

const healthy = {
  repo: { private: true }, uploads: [], artifacts: [], cacheBytes: 0, caches: [],
};
const kinds = (readings) => judge({ ...healthy, ...readings }, NOW).map((f) => f.kind);

test('a healthy repo has nothing off', () => {
  assert.deepEqual(kinds({}), []);
});

test('artifact readings judge a private repo only', () => {
  const uploads = [{ path: 'w.yml', line: 3, days: null }];
  const artifacts = [{ name: 'dist', size_in_bytes: ARTIFACT_BYTES_LIMIT + 1, expired: false }];
  assert.deepEqual(kinds({ uploads, artifacts }), ['artifact-retention', 'artifact-storage']);
  assert.deepEqual(kinds({ repo: { private: false }, uploads, artifacts }), []);
});

test('stored artifacts are off only above the bar, and expired ones do not count', () => {
  const at = (bytes, expired = false) => ({ name: 'dist', size_in_bytes: bytes, expired });
  assert.deepEqual(kinds({ artifacts: [at(ARTIFACT_BYTES_LIMIT)] }), []);
  assert.deepEqual(kinds({ artifacts: [at(ARTIFACT_BYTES_LIMIT), at(1)] }), ['artifact-storage']);
  assert.deepEqual(kinds({ artifacts: [at(ARTIFACT_BYTES_LIMIT), at(1, true)] }), []);
});

test('the cache is off from exactly the near-limit share', () => {
  const bar = CACHE_LIMIT_BYTES * CACHE_NEAR_LIMIT;
  assert.deepEqual(kinds({ cacheBytes: bar - 1 }), []);
  assert.deepEqual(kinds({ cacheBytes: bar, repo: { private: false } }), ['cache-size']);
});

// A cache entry saved `d` days ago, read again `readAfterMin` minutes later (null: never).
const entry = (d, readAfterMin, bytes = 100 * MB) => ({
  key: `go-${d}-${readAfterMin}`, ref: 'refs/heads/main', size_in_bytes: bytes,
  created_at: daysAgo(d),
  last_accessed_at: new Date(Date.parse(daysAgo(d)) + (readAfterMin ?? 0) * 60000).toISOString(),
});

test('cache entries saved and never restored are off once they are most of the week', () => {
  const never = Array.from({ length: WRITE_ONLY_MIN_ENTRIES }, (_, i) => entry(2 + i * 0.5, null));
  assert.deepEqual(kinds({ caches: never }), ['cache-write-only']);
  // One fewer write-only entry is a branch that never ran again, not a broken key.
  assert.deepEqual(kinds({ caches: never.slice(1) }), []);
  // Restored ones outweighing them: most of what the week wrote was read back.
  const restored = Array.from({ length: 6 }, () => entry(3, 120));
  assert.deepEqual(kinds({ caches: [...never, ...restored] }), []);
  // Saved in the last day: not yet had the chance to be restored.
  const fresh = Array.from({ length: WRITE_ONLY_MIN_ENTRIES }, () => entry(0.5, null));
  assert.deepEqual(kinds({ caches: fresh }), []);
  // Saved before the window: not this week's.
  const old = Array.from({ length: WRITE_ONLY_MIN_ENTRIES }, () => entry(8, null));
  assert.deepEqual(kinds({ caches: old }), []);
});

// The REST side the worker reaches on its own token, scripted per path.
function fakeGh({ isPrivate = true, artifacts = [], cacheBytes = 0, caches = [] } = {}) {
  const writes = [];
  const gh = async (path, { method = 'GET', body } = {}) => {
    if (method !== 'GET') {
      writes.push({ method, path, body });
      return { status: method === 'POST' ? 201 : 200, json: { number: 41 } };
    }
    if (path === '/repos/acme/member') return { status: 200, json: { private: isPrivate } };
    if (path.startsWith('/repos/acme/member/actions/artifacts')) return { status: 200, json: { artifacts } };
    if (path === '/repos/acme/member/actions/cache/usage') return { status: 200, json: { active_caches_size_in_bytes: cacheBytes } };
    if (path.startsWith('/repos/acme/member/actions/caches')) return { status: 200, json: { actions_caches: caches } };
    return { status: 404, json: null };
  };
  return { gh, writes };
}

function checkout(workflowText) {
  const root = mkdtempSync(join(tmpdir(), 'repo-health-'));
  mkdirSync(join(root, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(root, '.github', 'workflows', 'acme.yml'), workflowText);
  return root;
}
const leaky = checkout(workflow(`      - uses: actions/upload-artifact@v4
        with:
          name: dist`));
const clean = checkout(workflow('      - run: echo'));
const comments = () => sdk.calls.filter((c) => c.method === 'github.createComment');

test('something off with no open issue opens the one titled issue, carrying the finding and its line', async () => {
  openIssues = [];
  sdk.calls.length = 0;
  const { gh, writes } = fakeGh();
  await worker({ root: leaky, repo: 'acme/member' }, gh, NOW);
  assert.deepEqual(sdk.calls.filter((c) => c.method === 'github.findOrCreateTracker').map((c) => c.args.title), [ISSUE_TITLE]);
  assert.equal(writes.length, 1);
  assert.deepEqual([writes[0].method, writes[0].path, writes[0].body.state], ['PATCH', '/repos/acme/member/issues/41', 'open']);
  assert.match(writes[0].body.body, /\.github\/workflows\/acme\.yml:7/);
  assert.deepEqual(readKinds(writes[0].body.body), ['artifact-retention']);
  assert.equal(comments().length, 0);
});

test('a steady finding rewrites the open issue without a comment; a new one comments once', async () => {
  const { gh, writes } = fakeGh();
  openIssues = [{ number: 41, title: ISSUE_TITLE, state: 'open', labels: [], body: '<!-- repo-health: artifact-retention -->' }];
  sdk.calls.length = 0;
  await worker({ root: leaky, repo: 'acme/member' }, gh, NOW);
  assert.deepEqual(writes.map((w) => [w.method, w.path]), [['PATCH', '/repos/acme/member/issues/41']]);
  assert.equal(comments().length, 0);

  const grown = fakeGh({ cacheBytes: CACHE_LIMIT_BYTES });
  sdk.calls.length = 0;
  await worker({ root: leaky, repo: 'acme/member' }, grown.gh, NOW);
  assert.deepEqual(readKinds(grown.writes[0].body.body), ['artifact-retention', 'cache-size']);
  assert.equal(comments().length, 1);
  assert.match(comments()[0].args.body, /cache holds 10\.0 GB/);
});

test('nothing off closes an open issue, and touches nothing when none is open', async () => {
  openIssues = [{ number: 41, title: ISSUE_TITLE, state: 'open', labels: [], body: '' }];
  sdk.calls.length = 0;
  const closing = fakeGh();
  await worker({ root: clean, repo: 'acme/member' }, closing.gh, NOW);
  assert.deepEqual(closing.writes.map((w) => w.body.state), ['closed']);
  assert.equal(comments().length, 1);

  openIssues = [];
  sdk.calls.length = 0;
  const quiet = fakeGh();
  await worker({ root: clean, repo: 'acme/member' }, quiet.gh, NOW);
  assert.deepEqual(quiet.writes, []);
  assert.equal(comments().length, 0);
});

test('a reading that fails stops the run rather than judging it healthy', async () => {
  openIssues = [{ number: 41, title: ISSUE_TITLE, state: 'open', labels: [], body: '' }];
  const { gh, writes } = fakeGh();
  const broken = async (path, opts) => (path === '/repos/acme/member/actions/cache/usage' ? { status: 403, json: null } : gh(path, opts));
  await assert.rejects(worker({ root: clean, repo: 'acme/member' }, broken, NOW), /cache\/usage returned 403/);
  assert.deepEqual(writes, []);
});
