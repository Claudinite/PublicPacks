// The repo-health code_work: read what this repository keeps in Actions storage and
// cache, and keep one open issue while something there is off.
//
// Three readings, each from the source that bills or evicts it: the workflow files
// (what an upload will keep), the artifact list (what is stored now) and the cache
// list (what is written and whether anything reads it back). A finding names its
// probable causes rather than a fix: the numbers say something is off, never which
// change did it.
//
// The verdict logic is pure and exported (`scanWorkflows`, `judge`), so what counts
// as off is decided in one place and tested there.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { github, log } from '@claudinite/sdk';
import { makeGh } from './github-api.mjs';

export const WINDOW_DAYS = 7;
// An artifact handed from one job to the next is read within the run; a week covers
// a re-run, and anything kept longer is storage nobody reads.
export const MAX_RETENTION_DAYS = 7;
// GitHub Free's included Actions storage, the smallest any private repo's owner has.
// Artifacts of a public repo are not billed, so only a private one is judged on them.
export const ARTIFACT_BYTES_LIMIT = 500 * 1024 ** 2;
// The per-repo cache limit; past it GitHub evicts the oldest entries, so a cache that
// lives near it keeps throwing away what the next run wanted.
export const CACHE_LIMIT_BYTES = 10 * 1024 ** 3;
export const CACHE_NEAR_LIMIT = 0.8;
// A cache entry is "write-only" when nothing restored it in the day after it was
// saved. A few are normal (a branch that never ran again); many, making up most of
// what the week wrote, is a key that changes on every run or a restore that misses.
export const WRITE_ONLY_MIN_ENTRIES = 5;
export const WRITE_ONLY_SHARE = 0.5;
const SETTLE_MS = 86400 * 1000;
const ACCESS_SLACK_MS = 10 * 60 * 1000;

const mb = (bytes) => `${Math.round(bytes / 1024 ** 2)} MB`;
const gb = (bytes) => `${(bytes / 1024 ** 3).toFixed(1)} GB`;

/**
 * Every `actions/upload-artifact` step in `files` ({ path, text }) that keeps its
 * artifact longer than MAX_RETENTION_DAYS: no `retention-days` (the repo default,
 * 90 days unless changed) or a number above the bar. An expression is not judged.
 */
export function scanWorkflows(files) {
  const found = [];
  for (const { path, text } of files) {
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (!/^\s*(-\s+)?uses:\s*['"]?actions\/upload-artifact@/.test(line)) return;
      let start = i;
      while (start > 0 && !/^\s*-\s/.test(lines[start])) start--;
      const indent = lines[start].search(/\S/);
      let retention;
      for (let j = start + 1; j < lines.length; j++) {
        const l = lines[j];
        if (l.trim() && !l.trim().startsWith('#') && l.search(/\S/) <= indent) break;
        const m = l.match(/^\s*retention-days:\s*(.+?)\s*(#.*)?$/);
        if (m) retention = m[1].replace(/^['"]|['"]$/g, '');
      }
      if (retention !== undefined && !/^\d+$/.test(retention)) return;
      const days = retention === undefined ? null : Number(retention);
      if (days !== null && days <= MAX_RETENTION_DAYS) return;
      found.push({ path, line: i + 1, days });
    });
  }
  return found;
}

/**
 * The findings for one week's readings. `repo` is the API's repository record,
 * `artifacts` and `caches` its lists, `cacheBytes` the cache usage total. Pure.
 */
export function judge({ repo, uploads, artifacts, cacheBytes, caches }, nowMs) {
  const findings = [];

  if (repo.private && uploads.length) {
    findings.push({
      kind: 'artifact-retention',
      summary: `${uploads.length} artifact upload${uploads.length === 1 ? '' : 's'} keep${uploads.length === 1 ? 's' : ''} artifacts longer than ${MAX_RETENTION_DAYS} days`,
      detail: uploads.map((u) => `- \`${u.path}:${u.line}\` — ${u.days === null ? 'no `retention-days`, so the repository default (90 days unless changed)' : `\`retention-days: ${u.days}\``}`),
      causes: [
        'an upload written without `retention-days`, which keeps the artifact for the repository default',
        'a retention set for a reader that no longer exists (a later job or workflow that once downloaded it)',
        'the repository retention setting is lower than 90 days, in which case the stored list below is the truer reading',
      ],
    });
  }

  const stored = artifacts.filter((a) => !a.expired);
  const storedBytes = stored.reduce((n, a) => n + (a.size_in_bytes ?? 0), 0);
  if (repo.private && storedBytes > ARTIFACT_BYTES_LIMIT) {
    const byName = new Map();
    for (const a of stored) {
      const e = byName.get(a.name) ?? { name: a.name, count: 0, bytes: 0 };
      e.count++; e.bytes += a.size_in_bytes ?? 0;
      byName.set(a.name, e);
    }
    const top = [...byName.values()].sort((x, y) => y.bytes - x.bytes).slice(0, 5);
    findings.push({
      kind: 'artifact-storage',
      summary: `${mb(storedBytes)} of artifacts stored (${stored.length} artifacts), above ${mb(ARTIFACT_BYTES_LIMIT)}`,
      detail: top.map((e) => `- \`${e.name}\` — ${e.count} stored, ${mb(e.bytes)}`),
      causes: [
        'artifacts kept the 90-day default before a shorter retention landed; new uploads expire, stored ones keep their old date',
        'a workflow that started uploading a large build on every run',
        'runs that fail or are re-run, each keeping its own copy',
      ],
    });
  }

  if (cacheBytes >= CACHE_LIMIT_BYTES * CACHE_NEAR_LIMIT) {
    findings.push({
      kind: 'cache-size',
      summary: `the Actions cache holds ${gb(cacheBytes)}, near the ${gb(CACHE_LIMIT_BYTES)} limit where GitHub evicts the oldest entries`,
      detail: [],
      causes: [
        'a cache key that changes on every run, so each run adds an entry instead of reusing one',
        'many branches each saving their own copy of a large cache',
        'a cached path that grew (a build directory or a dependency store caching more than it should)',
      ],
    });
  }

  const since = nowMs - WINDOW_DAYS * 86400 * 1000;
  const settled = caches.filter((c) => {
    const created = Date.parse(c.created_at);
    return created >= since && created <= nowMs - SETTLE_MS;
  });
  const writeOnly = settled.filter((c) => Date.parse(c.last_accessed_at) - Date.parse(c.created_at) < ACCESS_SLACK_MS);
  const settledBytes = settled.reduce((n, c) => n + (c.size_in_bytes ?? 0), 0);
  const writeOnlyBytes = writeOnly.reduce((n, c) => n + (c.size_in_bytes ?? 0), 0);
  if (writeOnly.length >= WRITE_ONLY_MIN_ENTRIES && settledBytes > 0 && writeOnlyBytes / settledBytes >= WRITE_ONLY_SHARE) {
    findings.push({
      kind: 'cache-write-only',
      summary: `${writeOnly.length} of the ${settled.length} cache entries saved this week (${mb(writeOnlyBytes)} of ${mb(settledBytes)}) were never restored`,
      detail: writeOnly.slice(0, 5).map((c) => `- \`${c.key}\` on \`${c.ref}\` — ${mb(c.size_in_bytes ?? 0)}`),
      causes: [
        'a cache key holding something that changes every run (a run id, a timestamp, a file the build itself writes)',
        'a restore whose key or `restore-keys` no longer matches what the save writes',
        'saves from branches or pull requests whose caches no other run can read',
      ],
    });
  }

  return findings;
}

// The one issue this task keeps open while something is off. Its own, named here.
export const ISSUE_TITLE = '[claudinite] Repo health: Actions storage and cache';

export function issueBody(findings, { repo, nowIso }) {
  const sections = findings.flatMap((f) => [
    `### ${f.summary}`,
    '',
    ...(f.detail.length ? [...f.detail, ''] : []),
    'Probable causes:',
    '',
    ...f.causes.map((c) => `- ${c}`),
    '',
  ]);
  return [
    `<!-- repo-health: ${findings.map((f) => f.kind).join(',')} -->`,
    `What \`${repo}\` keeps in Actions storage and cache, read by the \`repo-health\` task — last ${nowIso}.`,
    'The task rewrites this body each week while something is off, and closes the issue once nothing is.',
    '',
    ...sections,
  ].join('\n');
}

// The finding kinds a body this task wrote carries.
export const readKinds = (body) => (body ?? '').match(/<!-- repo-health: ([\w,-]*) -->/)?.[1].split(',').filter(Boolean) ?? [];

function readWorkflowFiles(root) {
  const dir = join(root, '.github', 'workflows');
  let names;
  try { names = readdirSync(dir); } catch { return []; }
  return names
    .filter((n) => /\.ya?ml$/.test(n))
    .map((n) => ({ path: `.github/workflows/${n}`, text: readFileSync(join(dir, n), 'utf8') }));
}

const PAGE_SIZE = 100;
const MAX_PAGES = 10;

async function readPaged(gh, path, key) {
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const { status, json } = await gh(`${path}${sep}per_page=${PAGE_SIZE}&page=${page}`);
    if (status !== 200) throw new Error(`GET ${path} returned ${status}`);
    const batch = json?.[key] ?? [];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return all;
}

async function readJson(gh, path) {
  const { status, json } = await gh(path);
  if (status !== 200) throw new Error(`GET ${path} returned ${status}`);
  return json;
}

export async function worker({ root, repo }, gh = makeGh(), nowMs = Date.now()) {
  const record = await readJson(gh, `/repos/${repo}`);
  const uploads = scanWorkflows(readWorkflowFiles(root));
  const artifacts = await readPaged(gh, `/repos/${repo}/actions/artifacts`, 'artifacts');
  const usage = await readJson(gh, `/repos/${repo}/actions/cache/usage`);
  const caches = await readPaged(gh, `/repos/${repo}/actions/caches?sort=created_at&direction=desc`, 'actions_caches');

  const findings = judge({
    repo: record, uploads, artifacts, cacheBytes: usage?.active_caches_size_in_bytes ?? 0, caches,
  }, nowMs);
  log(`${record.private ? 'private' : 'public'}; ${uploads.length} long-retention uploads, ${artifacts.length} artifacts, ${caches.length} cache entries`);
  for (const f of findings) log(`off: ${f.summary}`);

  const open = (await github.listIssues({ state: 'open' }))
    .filter((i) => i.title.trim() === ISSUE_TITLE)
    .sort((a, b) => a.number - b.number)[0];
  const nowIso = new Date(nowMs).toISOString();

  if (!findings.length) {
    if (open) {
      await github.createComment({ issue: open.number, body: `${nowIso} — nothing is off any more; closing.` });
      const { status } = await gh(`/repos/${repo}/issues/${open.number}`, { method: 'PATCH', body: { state: 'closed', state_reason: 'completed' } });
      if (status !== 200) throw new Error(`closing #${open.number} returned ${status}`);
      log(`closed #${open.number}`);
    } else {
      log('nothing is off');
    }
    return;
  }

  const body = issueBody(findings, { repo, nowIso });
  if (!open) {
    // The tracker lookup finds this title in any state, so a repo holds one health
    // issue for good: reopened each time something goes off, never a second one.
    const { number } = await github.findOrCreateTracker({ title: ISSUE_TITLE });
    const { status } = await gh(`/repos/${repo}/issues/${number}`, { method: 'PATCH', body: { state: 'open', body } });
    if (status !== 200) throw new Error(`opening #${number} returned ${status}`);
    log(`opened #${number}`);
    return;
  }
  const { status } = await gh(`/repos/${repo}/issues/${open.number}`, { method: 'PATCH', body: { body } });
  if (status !== 200) throw new Error(`updating #${open.number} returned ${status}`);
  // A comment only for a finding the issue did not carry yet: it is what notifies, and
  // a weekly "still off" would be a scroll of identical lines.
  const before = readKinds(open.body);
  const added = findings.filter((f) => !before.includes(f.kind));
  if (added.length) {
    await github.createComment({ issue: open.number, body: `${nowIso} — newly off: ${added.map((f) => f.summary).join('; ')}.` });
  }
  log(`updated #${open.number}${added.length ? `, ${added.length} new` : ''}`);
}
