// No pack text says how a repo's own issues are filed (the Engine's docs/repo-issues.md): a repo
// may keep them as GitHub issues or as files, a session finds which, and a pack that names a
// GitHub issue tool would be turned into a hard-coded call by the prose-to-checks conversion.
// Prose may say "open an issue"; it never names the mechanism. The places below may, each for
// the reason beside it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('../../', import.meta.url);

export const namesIssueMechanism = (text) =>
  /\b(mcp__github__)?(issue_write|add_issue_comment|sub_issue_write)\b/.test(text)
  || /\bgh\s+issue\b/.test(text)
  || /(\$\{[^}]*\}|\{repo\}|repos\/[^\s/]+\/[^\s/]+)\/issues\b/.test(text);

const allowed = [
  [/^packs\/basics\//, 'moves to a personal fleet'],
  [/^packs\/[^/]+\/tasks\//, 'a task is the tasks mechanism, whose work items are GitHub issues'],
  [/^packs\/task-flow\/skills\/do-later\//, 'files a task work item'],
  [/^packs\/git-github\//, "its subject is GitHub's own tools: how they behave, never which tracker a repo keeps"],
];

const skipped = (f) => /\/provenance\/|(^|\/)test\/|\.test\.mjs$|_test\.go$/.test(f);

test('the scan recognises a named issue mechanism and lets "open an issue" through', () => {
  assert.equal(namesIssueMechanism('file it (`mcp__github__issue_write`, method `create`)'), true);
  assert.equal(namesIssueMechanism('post it with `add_issue_comment`'), true);
  assert.equal(namesIssueMechanism('gh issue create --title t'), true);
  assert.equal(namesIssueMechanism('await gh(`/repos/${repo}/issues/${n}`)'), true);
  assert.equal(namesIssueMechanism('POST /repos/{repo}/issues'), true);
  assert.equal(namesIssueMechanism('Open one tracking issue per adopting repo.'), false);
  assert.equal(namesIssueMechanism('the window\'s commits/PRs/issues'), false);
});

test('no pack text names an issue mechanism outside the places allowed one', () => {
  const files = execFileSync('git', ['ls-files', 'packs'], { cwd: root, encoding: 'utf8' })
    .split('\n').filter((f) => f && !skipped(f) && /\.(md|json|ya?ml|m?js|sh|go)$/.test(f));
  assert.ok(files.length > 200, `only ${files.length} pack files found - the scan's scope is wrong`);
  for (const [re] of allowed) assert.ok(files.some((f) => re.test(f)), `${re} matches no pack file; drop it`);
  const found = files.filter((f) => !allowed.some(([re]) => re.test(f)) && namesIssueMechanism(readFileSync(new URL(f, root), 'utf8')));
  assert.deepEqual(found, []);
});
