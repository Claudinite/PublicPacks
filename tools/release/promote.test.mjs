import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readRoots, parsePrivateKey } from '../sign/sign.mjs';
import { verifyCatalog } from './catalog.mjs';
import { readIndex, verifyIndex } from './index.mjs';
import { githubReader, rewriteBranch, soak, SOAK_HOURS, withoutBlockers } from './promote.mjs';
import { branchObjects, planUpload } from './upload.mjs';
import { build, commitAll, editVendored, git, packJson, publish, put, run, scratch, show, testChain, vendoredLog, world } from './test-fixture.mjs';

// acme-pack with 1.60101.1 and 1.60101.2 on vendored, acme-pack-two with 1.60101.1, all canary.
function released() {
  const w = world();
  const chain = testChain(scratch());
  assert.equal(publish(w, build(w).archives, chain).status, 0);
  put(w.src, 'packs/acme-pack/pack.json', packJson('1.60101.2', { requires: ['acme-pack-two'] }));
  commitAll(w.src, 'bump');
  assert.equal(publish(w, build(w).archives, chain).status, 0);
  return { w, chain };
}

const signing = (chain) => ({ CN_PACKS_KEY: chain.key, CN_PACKS_CERT: chain.cert });
const cli = (w, chain, args) => run([...args, '--repo', w.src, '--remote', w.remote, '--roots', chain.roots], signing(chain));
// The catalog pair is rewritten with every index it covers, so it is never one of the others.
const otherBlobs = (w, except) => git(w.remote, 'ls-tree', '-r', 'vendored').split('\n')
  .filter((l) => ![`${except}/index.json`, `${except}/index.sig.json`, 'catalog.json', 'catalog.sig.json'].some((p) => l.endsWith(`\t${p}`)));
const catalogOf = (w) => JSON.parse(show(w, 'catalog.json').toString('utf8'));

const BLOCKERS = { repo: 'acme/engine', label: 'release-blocker' };

const PUBLISHED = '2026-09-01T00:00:00Z';
const HOUR = 3600e3;
const SOAKED = new Date(Date.parse(PUBLISHED) + SOAK_HOURS * HOUR);
const index = (pack, versions) => ({
  pack,
  index: { v: 1, pack, serial: versions.length, versions: versions.map(([version, channel = 'canary', revoked = false]) => ({ version, channel, revoked, publishedAt: PUBLISHED })) },
});
const candidate = (pack, version) => ({ pack, version, publishedAt: PUBLISHED });
const issue = (number, title, author_association, body = '') => ({ number, title, body, author_association, html_url: `u${number}` });

function fakeReader({ issues = [], missingBlockersRepo = false } = {}) {
  const calls = [];
  return {
    calls,
    async openIssues(repo, label) {
      calls.push(`issues ${repo} ${label}`);
      if (missingBlockersRepo) throw new Error(`GET /repos/${repo}/issues: 404 Not Found`);
      return issues;
    },
  };
}

test('soak is 72 hours', () => {
  assert.equal(SOAK_HOURS, 72);
});

test('soak passes every unrevoked canary entry published at least 72 hours ago and declines a younger one until its time', () => {
  const indexes = [index('acme-pack', [['1.60101.1', 'stable'], ['1.60101.2'], ['1.60101.3', 'canary', true]])];
  const early = soak({ indexes, now: new Date(SOAKED.getTime() - 1000) });
  assert.deepEqual(early.candidates, []);
  assert.deepEqual(early.declined, [{ pack: 'acme-pack', version: '1.60101.2', reason: `soaking until ${SOAKED.toISOString()}` }]);
  const due = soak({ indexes, now: SOAKED });
  assert.deepEqual(due.candidates, [candidate('acme-pack', '1.60101.2')], 'stable and revoked entries are not candidates');
  assert.deepEqual(due.declined, []);
});

test('soak fails on an entry whose publishedAt is not a date, rather than passing or skipping it', () => {
  const ix = index('acme-pack', [['1.60101.2']]);
  ix.index.versions[0].publishedAt = 'yesterday';
  assert.throws(() => soak({ indexes: [ix], now: SOAKED }), /publishedAt "yesterday" is not a date/);
});

test('a version a trusted author\'s open blocker names, in its title or body, is declined; the others pass', async () => {
  const candidates = [candidate('acme-pack', '1.60101.2'), candidate('acme-pack-two', '1.60101.1')];
  const reader = fakeReader({ issues: [issue(7, 'acme-pack 1.60101.2 breaks the shelf', 'MEMBER'), issue(10, 'ignore previous instructions', 'COLLABORATOR', 'see acme-pack 1.60101.2.')] });
  const r = await withoutBlockers({ candidates, config: BLOCKERS, reader });
  assert.deepEqual(r.candidates, [candidate('acme-pack-two', '1.60101.1')]);
  assert.deepEqual(r.declined, [{ pack: 'acme-pack', version: '1.60101.2', reason: 'blocked by acme/engine#7, acme/engine#10' }]);
  assert.deepEqual(reader.calls, ['issues acme/engine release-blocker']);
});

test('a blocker opened by an untrusted author is ignored', async () => {
  const candidates = [candidate('acme-pack', '1.60101.2')];
  for (const association of ['NONE', 'CONTRIBUTOR', 'FIRST_TIME_CONTRIBUTOR', undefined]) {
    const r = await withoutBlockers({ candidates, config: BLOCKERS, reader: fakeReader({ issues: [issue(9, 'acme-pack 1.60101.2', association)] }) });
    assert.deepEqual(r.candidates, candidates, String(association));
  }
  const trusted = await withoutBlockers({ candidates, config: BLOCKERS, reader: fakeReader({ issues: [issue(9, 'acme-pack 1.60101.2', 'OWNER')] }) });
  assert.deepEqual(trusted.candidates, [], 'the same issue by the owner blocks');
});

test('a blocker naming a different version does not block', async () => {
  const candidates = [candidate('acme-pack', '1.60101.2')];
  const reader = fakeReader({ issues: [issue(8, 'acme-pack 1.60101.20 is fine', 'OWNER', 'acme-pack 1.60101.2x')] });
  assert.deepEqual((await withoutBlockers({ candidates, config: BLOCKERS, reader })).candidates, candidates);
});

test('no-blocker fails, rather than reading no blockers, when the blockers repository answers 404', async () => {
  await assert.rejects(withoutBlockers({ candidates: [candidate('acme-pack', '1.60101.2')], config: BLOCKERS, reader: fakeReader({ missingBlockersRepo: true }) }), /404/);
});

test('soak on the CLI writes the candidates a later instant passes, and none before 72 hours', () => {
  const { w, chain } = released();
  const dir = scratch();
  const out = join(dir, 'soaked.json');
  const young = run(['soak', '--out', out, '--repo', w.src, '--remote', w.remote], signing(chain));
  assert.equal(young.status, 0, young.out);
  assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')).candidates, []);
  assert.match(young.out, /^not promoted: acme-pack 1\.60101\.2: soaking until /m);
  const later = new Date(Date.now() + (SOAK_HOURS + 1) * HOUR).toISOString();
  const old = run(['soak', '--out', out, '--now', later, '--repo', w.src, '--remote', w.remote], signing(chain));
  assert.equal(old.status, 0, old.out);
  assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')).candidates.map((c) => `${c.pack} ${c.version}`), ['acme-pack 1.60101.1', 'acme-pack 1.60101.2', 'acme-pack-two 1.60101.1']);
});

test('promote --candidates with no candidate prints so, exits 0 and writes nothing', () => {
  const { w, chain } = released();
  const tip = git(w.remote, 'rev-parse', 'vendored');
  const dir = scratch();
  writeFileSync(join(dir, 'unblocked.json'), JSON.stringify({ candidates: [] }));
  const p = cli(w, chain, ['promote', '--candidates', join(dir, 'unblocked.json')]);
  assert.equal(p.status, 0, p.out);
  assert.match(p.out, /^nothing to promote$/m);
  assert.equal(git(w.remote, 'rev-parse', 'vendored'), tip);
});

test('promote --candidates writes one re-signed commit per promotion and leaves every other blob alone', async () => {
  const { w, chain } = released();
  const before = otherBlobs(w, 'acme-pack');
  const dir = scratch();
  const indexes = [{ pack: 'acme-pack', index: readIndex(show(w, 'acme-pack/index.json')) }];
  const soaked = soak({ indexes, now: new Date(Date.now() + SOAK_HOURS * HOUR) });
  const clear = await withoutBlockers({ candidates: soaked.candidates, config: BLOCKERS, reader: fakeReader() });
  writeFileSync(join(dir, 'unblocked.json'), JSON.stringify(clear));
  const p = cli(w, chain, ['promote', '--candidates', join(dir, 'unblocked.json')]);
  assert.equal(p.status, 0, p.out);
  assert.deepEqual(vendoredLog(w).slice(0, 3), ['Promote acme-pack 1.60101.2', 'Promote acme-pack 1.60101.1', 'Release acme-pack 1.60101.2']);
  const bytes = show(w, 'acme-pack/index.json');
  const ix = readIndex(bytes);
  assert.equal(ix.serial, 4);
  assert.deepEqual(ix.versions.map((e) => e.channel), ['stable', 'stable']);
  verifyIndex(bytes, JSON.parse(show(w, 'acme-pack/index.sig.json').toString('utf8')), readRoots(chain.roots), new Date());
  assert.deepEqual(otherBlobs(w, 'acme-pack'), before);
});

test('promote --candidates skips a candidate a dispatch promoted meanwhile, and promotes the rest', () => {
  const { w, chain } = released();
  const dir = scratch();
  writeFileSync(join(dir, 'unblocked.json'), JSON.stringify({ candidates: [candidate('acme-pack', '1.60101.1'), candidate('acme-pack-two', '1.60101.1')] }));
  assert.equal(cli(w, chain, ['promote', '--pack', 'acme-pack', '--version', '1.60101.1', '--by', 'acme-user']).status, 0);
  const p = cli(w, chain, ['promote', '--candidates', join(dir, 'unblocked.json')]);
  assert.equal(p.status, 0, p.out);
  assert.match(p.out, /^skipped: acme-pack 1\.60101\.1 is already stable$/m);
  assert.equal(vendoredLog(w)[0], 'Promote acme-pack-two 1.60101.1');
});

test('a dispatched promote promotes one entry regardless of evidence and names who dispatched it', () => {
  const { w, chain } = released();
  const before = otherBlobs(w, 'acme-pack');
  const p = cli(w, chain, ['promote', '--pack', 'acme-pack', '--version', '1.60101.1', '--by', 'acme-user']);
  assert.equal(p.status, 0, p.out);
  assert.match(p.out, /^Promote acme-pack 1\.60101\.1 \(dispatched by acme-user\)$/m);
  assert.equal(vendoredLog(w)[0], 'Promote acme-pack 1.60101.1 (dispatched by acme-user)');
  const ix = readIndex(show(w, 'acme-pack/index.json'));
  assert.equal(ix.serial, 3);
  assert.deepEqual(ix.versions.map((e) => e.channel), ['stable', 'canary']);
  assert.deepEqual(otherBlobs(w, 'acme-pack'), before);
  verifyCatalog(show(w, 'catalog.json'), JSON.parse(show(w, 'catalog.sig.json').toString('utf8')), readRoots(chain.roots), new Date());
  assert.deepEqual(catalogOf(w).packs.filter((e) => e.id === 'acme-pack').map((e) => `${e.version} ${e.channel}`), ['1.60101.1 stable', '1.60101.2 canary']);
});

test('a dispatched promote refuses a version not in the index, already stable, or revoked; the branch is untouched', () => {
  const { w, chain } = released();
  assert.equal(cli(w, chain, ['promote', '--pack', 'acme-pack', '--version', '1.60101.1', '--by', 'acme-user']).status, 0);
  assert.equal(cli(w, chain, ['revoke', '--pack', 'acme-pack', '--version', '1.60101.2', '--by', 'acme-user']).status, 0);
  const tip = git(w.remote, 'rev-parse', 'vendored');
  for (const [version, why] of [['1.60199.1', /not in the index/], ['1.60101.1', /already stable/], ['1.60101.2', /revoked/]]) {
    const p = cli(w, chain, ['promote', '--pack', 'acme-pack', '--version', version, '--by', 'acme-user']);
    assert.notEqual(p.status, 0, p.out);
    assert.match(p.out, why);
  }
  const unknown = cli(w, chain, ['promote', '--pack', 'acme-nothing', '--version', '1.60101.1', '--by', 'acme-user']);
  assert.notEqual(unknown.status, 0);
  assert.equal(git(w.remote, 'rev-parse', 'vendored'), tip);
});

test('revoke sets revoked with its own commit and refuses an already-revoked version', () => {
  const { w, chain } = released();
  const p = cli(w, chain, ['revoke', '--pack', 'acme-pack', '--version', '1.60101.2', '--by', 'acme-user']);
  assert.equal(p.status, 0, p.out);
  assert.equal(vendoredLog(w)[0], 'Revoke acme-pack 1.60101.2 (dispatched by acme-user)');
  const ix = readIndex(show(w, 'acme-pack/index.json'));
  assert.equal(ix.serial, 3);
  assert.deepEqual(ix.versions.map((e) => e.revoked), [false, true]);
  assert.deepEqual(catalogOf(w).packs.filter((e) => e.id === 'acme-pack').map((e) => `${e.version} ${e.channel}`), ['1.60101.1 canary'], 'a revoked version leaves the catalog');
  const again = cli(w, chain, ['revoke', '--pack', 'acme-pack', '--version', '1.60101.2', '--by', 'acme-user']);
  assert.notEqual(again.status, 0);
  assert.match(again.out, /already revoked/);
});

test('a dispatch needs --pack, --version and --by together', () => {
  const { w, chain } = released();
  const p = cli(w, chain, ['promote', '--pack', 'acme-pack', '--version', '1.60101.1']);
  assert.notEqual(p.status, 0);
  assert.match(p.out, /--by/);
});

test('a promotion computed against a branch that moved under it fails the push and never force-pushes', () => {
  const { w, chain } = released();
  const key = parsePrivateKey(readFileSync(chain.key, 'utf8'));
  const certificate = JSON.parse(readFileSync(chain.cert, 'utf8'));
  let moved;
  assert.throws(() => rewriteBranch({
    repo: w.src, remote: w.remote, roots: readRoots(chain.roots), key, certificate, now: new Date(),
    changes: [{ pack: 'acme-pack', version: '1.60101.1', action: 'promote', by: 'acme-user' }],
    beforePush: () => {
      put(w.src, 'packs/acme-pack-two/pack.json', packJson('1.60101.2'));
      commitAll(w.src, 'bump two');
      assert.equal(publish(w, build(w).archives, chain).status, 0);
      moved = git(w.remote, 'rev-parse', 'vendored');
    },
  }), /push/);
  assert.equal(git(w.remote, 'rev-parse', 'vendored'), moved);
  assert.equal(vendoredLog(w)[0], 'Release acme-pack-two 1.60101.2');

  const retry = cli(w, chain, ['promote', '--pack', 'acme-pack', '--version', '1.60101.1', '--by', 'acme-user']);
  assert.equal(retry.status, 0, retry.out);
  assert.equal(readIndex(show(w, 'acme-pack/index.json')).serial, 3);
});

test('after a promotion the upload plan rewrites that pack\'s index pair and nothing else', async () => {
  const { w, chain } = released();
  const read = (path) => show(w, path);
  const ids = ['acme-pack', 'acme-pack-two'];
  const store = new Map(branchObjects(read, ids).map((o) => [o.key, o.body]));
  const bucket = { async get(k) { return store.get(k) ?? null; }, async put() { throw new Error('plan only'); } };
  assert.equal(cli(w, chain, ['promote', '--pack', 'acme-pack-two', '--version', '1.60101.1', '--by', 'acme-user']).status, 0);
  const actions = await planUpload(branchObjects(read, ids), bucket);
  assert.deepEqual(actions.filter((a) => a.put).map((a) => a.key), ['packs/acme-pack-two/index.json', 'packs/acme-pack-two/index.sig.json']);
});

test('the GitHub reader asks for open release-blocker issues, leaves out pull requests and fails on a non-2xx', async () => {
  const urls = [];
  const fetch = async (url, init) => {
    urls.push(url);
    assert.equal(init.headers.authorization, 'Bearer acme-token');
    const u = new URL(url);
    if (u.pathname === '/repos/acme/engine/issues') return Response.json([issue(1, 't', 'OWNER'), { ...issue(2, 'a pull request', 'OWNER'), pull_request: {} }]);
    return new Response('{"message":"Not Found"}', { status: 404 });
  };
  const r = githubReader({ token: 'acme-token', fetch });
  assert.deepEqual((await r.openIssues('acme/engine', 'release-blocker')).map((i) => i.number), [1]);
  assert.deepEqual(urls, ['https://api.github.com/repos/acme/engine/issues?labels=release-blocker&state=open&per_page=100']);
  await assert.rejects(r.openIssues('acme/private', 'release-blocker'), /404/);
});

// GitHub answering the issues list in two pages linked by Link: rel="next", the blocker on page
// two.
function pagedGithub() {
  const urls = [];
  const filler = Array.from({ length: 100 }, (_, i) => issue(1000 + i, `unrelated ${i}`, 'OWNER', null));
  const fetch = async (url) => {
    urls.push(url);
    const u = new URL(url);
    if (u.pathname === '/repos/acme/engine/issues' && !u.searchParams.has('page')) {
      return Response.json(filler, { headers: { link: '<https://api.github.com/repos/acme/engine/issues?labels=release-blocker&state=open&per_page=100&page=2>; rel="next", <https://api.github.com/repos/acme/engine/issues?labels=release-blocker&state=open&per_page=100&page=2>; rel="last"' } });
    }
    if (u.pathname === '/repos/acme/engine/issues' && u.searchParams.get('page') === '2') {
      return Response.json([issue(7, 'acme-pack 1.60101.2 breaks the shelf', 'MEMBER', null)], { headers: { link: '<https://api.github.com/repos/acme/engine/issues?per_page=100&page=1>; rel="prev"' } });
    }
    return new Response('{"message":"Not Found"}', { status: 404 });
  };
  return { urls, fetch };
}

test('openIssues follows Link: rel="next" and returns every page', async () => {
  const gh = pagedGithub();
  const issues = await githubReader({ token: 'acme-token', fetch: gh.fetch }).openIssues('acme/engine', 'release-blocker');
  assert.equal(issues.length, 101);
  assert.equal(issues.at(-1).number, 7);
  assert.equal(gh.urls.length, 2);
});

test('a blocker on the second page of issues blocks the promotion', async () => {
  const gh = pagedGithub();
  const r = await withoutBlockers({ candidates: [candidate('acme-pack', '1.60101.2')], config: BLOCKERS, reader: githubReader({ token: 'acme-token', fetch: gh.fetch }) });
  assert.deepEqual(r.candidates, []);
  assert.match(r.declined[0].reason, /blocked by acme\/engine#7/);
});

test('blockers.json names the repository and label the blocker read takes', async () => {
  const config = JSON.parse(readFileSync(new URL('./blockers.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(config).sort(), ['label', 'repo']);
  assert.match(config.repo, /^[\w.-]+\/[\w.-]+$/);
  assert.equal(config.label, 'release-blocker');
  assert.match(config.repo, /\/PublicPacks$/, 'blockers live where the promote job\'s own token can read them');
  const reader = fakeReader();
  await withoutBlockers({ candidates: [], config, reader });
  assert.deepEqual(reader.calls, [`issues ${config.repo} ${config.label}`]);
});

test('promote and revoke refuse, writing nothing, an index whose bytes no longer match its signature', () => {
  const { w, chain } = released();
  editVendored(w, (tree) => {
    const file = join(tree, 'acme-pack/index.json');
    const ix = JSON.parse(readFileSync(file, 'utf8'));
    ix.versions[0].sha256 = 'f'.repeat(64);
    writeFileSync(file, JSON.stringify(ix, null, 2) + '\n');
  }, 'tamper');
  for (const action of ['promote', 'revoke']) {
    const p = cli(w, chain, [action, '--pack', 'acme-pack', '--version', '1.60101.1', '--by', 'acme-user']);
    assert.notEqual(p.status, 0, p.out);
    assert.match(p.out, /acme-pack\/index\.json does not verify/);
    assert.equal(vendoredLog(w)[0], 'tamper');
  }
});
