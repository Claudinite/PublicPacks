import { test } from 'node:test';
import assert from 'node:assert/strict';
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

// A commit that changes only documentation ships nothing the site serves: Markdown is
// held out of the upload, and `docs/` is outside it.
const touching = (sha, ...files) => ({ sha, task: null, files });

test('a docs-only commit above the last release is nothing to release', () => {
  const verdict = gate.holds(commits(touching('aaa1111', 'docs/plan.md', 'site/README.md'), touching('ddd4444', 'docs/diagram.svg'), release('bbb2222')));
  assert.equal(verdict.holds, false);
  assert.match(verdict.reason, /only documentation/);
});

test('a commit that also touches what the site serves still releases', () => {
  const verdict = gate.holds(commits(touching('aaa1111', 'docs/plan.md'), touching('eee5555', 'README.md', 'site/index.html'), release('bbb2222')));
  assert.equal(verdict.holds, true);
  assert.match(verdict.context[0], /eee5555/);
  assert.doesNotMatch(verdict.context[0], /aaa1111/);
});

// A commit whose files the collector could not list is not known to be documentation.
test('a commit with no file list counts as a change', () => {
  assert.equal(gate.holds(commits(touching('aaa1111'), release('bbb2222'))).holds, true);
  assert.equal(gate.holds(commits(work('aaa1111'), release('bbb2222'))).holds, true);
});

test('a path that only mentions docs or md is not documentation', () => {
  assert.equal(gate.holds(commits(touching('aaa1111', 'site/docs.html'), release('bbb2222'))).holds, true);
  assert.equal(gate.holds(commits(touching('aaa1111', 'server/mdx.js'), release('bbb2222'))).holds, true);
});
