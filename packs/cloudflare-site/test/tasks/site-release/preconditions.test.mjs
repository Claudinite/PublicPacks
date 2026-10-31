import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { terms, RELEASE_TASK_ID } from '../../../tasks/site-release/preconditions.mjs';

const gate = terms['unreleased-commits'];
const commits = (...list) => ({ commits: { list, count: list.length } });
// Newest first, the order the collector preserves.
const work = (sha) => ({ sha, task: null });
const release = (sha) => ({ sha, task: RELEASE_TASK_ID });

test('runs when work landed above the last release', () => {
  const verdict = gate.holds(commits(work('aaa1111'), release('bbb2222'), work('ccc3333')));
  assert.equal(verdict.holds, true);
  assert.match(verdict.reason, /1 commit/);
  assert.match(verdict.context[0], /aaa1111/);
  // The commit below the water mark is already out; naming it would tell the reader
  // this release carries work it does not.
  assert.doesNotMatch(verdict.context[0], /ccc3333/);
});

// The loop the gate exists to stop: the release's own bump commit keeps the window
// non-empty, so a membership test would re-release the same bytes every night.
test('declines when the newest commit is the release itself', () => {
  const verdict = gate.holds(commits(release('bbb2222'), work('ccc3333')));
  assert.equal(verdict.holds, false);
  assert.match(verdict.reason, /the last release itself/);
});

// The same night's second pickup — a re-queue, or a force beside the anchor — must
// reach the same verdict, or a forced release doubles up.
test('a second evaluation after a release still declines', () => {
  const after = commits(release('bbb2222'), work('ccc3333'));
  assert.equal(gate.holds(after).holds, false);
  assert.equal(gate.holds(after).holds, false);
});

test('runs when the window holds work and no release at all', () => {
  assert.equal(gate.holds(commits(work('aaa1111'))).holds, true);
});

test('declines on a branch that did not move', () => {
  const verdict = gate.holds(commits());
  assert.equal(verdict.holds, false);
  assert.match(verdict.reason, /no commit landed/);
});

// A run of releases with nothing between them is the shape a re-queued park leaves.
test('consecutive releases at the top count as nothing to release', () => {
  assert.equal(gate.holds(commits(release('bbb2222'), release('bbb1111'), work('ccc3333'))).holds, false);
});

// The gate reads one signal and must declare it, or the collector never gathers what
// `holds` reaches for and every night reads an empty list as "nothing to release".
test('the signal the gate reads is the signal it declares', () => {
  assert.deepEqual(gate.signals, ['commits']);
  assert.equal(gate.holds({}).holds, false);
});

// The worker stamps its release commits with the id the queue hands it —
// `<pack>/<task>`, derived from the two directory names — and the gate recognises a
// release commit by comparing against this literal. A rename of either directory
// silently stops the gate seeing the release's own commits, which releases the same
// bytes every night forever.
test("the gate's task id is the one the directories give the queue", () => {
  assert.equal(RELEASE_TASK_ID, 'cloudflare-site/site-release');
});

// A commit counts only when it touches what the deploy ships, as the repo's own
// wrangler config declares it.
const touching = (sha, ...files) => ({ sha, task: null, files });

function inRepo(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'site-release-'));
  const was = process.env.GITHUB_WORKSPACE;
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  // The scheduler's job names its checkout; a term's own folder is somewhere inside it.
  process.env.GITHUB_WORKSPACE = dir;
  try { return fn(); } finally {
    if (was === undefined) delete process.env.GITHUB_WORKSPACE; else process.env.GITHUB_WORKSPACE = was;
    rmSync(dir, { recursive: true, force: true });
  }
}
const site = { 'wrangler.json': JSON.stringify({ main: 'server/index.js', assets: { directory: './site' } }) };

test('a commit outside every deployed path is nothing to release', () => inRepo(site, () => {
  const verdict = gate.holds(commits(touching('aaa1111', 'docs/plan.md', 'README.md'), touching('ddd4444', 'product-wiki/x.md', '.github/workflows/ci.yml'), release('bbb2222')));
  assert.equal(verdict.holds, false);
  assert.match(verdict.reason, /nothing the deploy ships/);
}));

// The published tree is the build's output: its watch_dir says what feeds it, and without one every
// commit counts.
const built = (watch) => ({ 'wrangler.json': JSON.stringify({ build: { command: 'python3 tools/build.py', watch_dir: watch }, assets: { directory: './out' } }) });
test('with a build command, a commit under its watch_dir releases and one outside it does not', () => inRepo(built(['web', 'tools/build.py']), () => {
  for (const input of ['web/page.js', 'tools/build.py']) {
    assert.equal(gate.holds(commits(touching('aaa1111', input), release('bbb2222'))).holds, true, input);
  }
  const verdict = gate.holds(commits(touching('aaa1111', 'docs/plan.md', 'tools/build.pyc'), release('bbb2222')));
  assert.equal(verdict.holds, false);
  assert.match(verdict.reason, /web, tools\/build\.py/);
}));

test('with a build command and no watch_dir, a commit anywhere releases', () => inRepo(built(undefined), () => {
  assert.equal(gate.holds(commits(touching('aaa1111', 'docs/plan.md'), release('bbb2222'))).holds, true);
}));

test('a commit touching a deployed path releases, and only it is named', () => inRepo(site, () => {
  for (const shipped of ['site/index.html', 'server/router.js', 'wrangler.json', 'package.json', 'package-lock.json']) {
    const verdict = gate.holds(commits(touching('aaa1111', 'docs/plan.md'), touching('eee5555', 'README.md', shipped), release('bbb2222')));
    assert.equal(verdict.holds, true, shipped);
    assert.match(verdict.context[0], /eee5555/);
    assert.doesNotMatch(verdict.context[0], /aaa1111/);
  }
}));

test('a path that only shares a prefix with a deployed folder is not deployed', () => inRepo(site, () => {
  assert.equal(gate.holds(commits(touching('aaa1111', 'site-notes.txt', 'serverless/x.js'), release('bbb2222'))).holds, false);
}));

// What cannot be judged counts: an unlisted commit, or a repo whose config the gate
// cannot read, goes to the release, which parks naming the config problem itself.
test('a commit with no file list counts as a change', () => inRepo(site, () => {
  assert.equal(gate.holds(commits(touching('aaa1111'), release('bbb2222'))).holds, true);
  assert.equal(gate.holds(commits(work('aaa1111'), release('bbb2222'))).holds, true);
}));

test('without a readable wrangler config every commit counts', () => {
  inRepo({}, () => assert.equal(gate.holds(commits(touching('aaa1111', 'docs/plan.md'), release('bbb2222'))).holds, true));
  inRepo({ 'wrangler.json': '{ not json' }, () => assert.equal(gate.holds(commits(touching('aaa1111', 'docs/plan.md'), release('bbb2222'))).holds, true));
});

test('without a job workspace the repo is the checkout around the task folder', () => {
  const dir = mkdtempSync(join(tmpdir(), 'site-release-'));
  const was = [process.cwd(), process.env.GITHUB_WORKSPACE];
  mkdirSync(join(dir, '.git'));
  mkdirSync(join(dir, 'tasks/site-release'), { recursive: true });
  writeFileSync(join(dir, 'wrangler.json'), site['wrangler.json']);
  delete process.env.GITHUB_WORKSPACE;
  process.chdir(join(dir, 'tasks/site-release'));
  try {
    assert.equal(gate.holds(commits(touching('aaa1111', 'docs/plan.md'), release('bbb2222'))).holds, false);
  } finally {
    process.chdir(was[0]);
    if (was[1] !== undefined) process.env.GITHUB_WORKSPACE = was[1];
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the config is read one directory down too', () => inRepo({ 'web/wrangler.jsonc': '// c\n{ "main": "src/w.mjs", "assets": { "directory": "public" } }' }, () => {
  assert.equal(gate.holds(commits(touching('aaa1111', 'web/public/a.html'), release('bbb2222'))).holds, true);
  assert.equal(gate.holds(commits(touching('aaa1111', 'public/a.html'), release('bbb2222'))).holds, false);
}));
