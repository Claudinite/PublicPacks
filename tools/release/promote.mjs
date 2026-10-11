// Promotion and revocation of published pack versions: the soak and blocker gates that pick the
// versions to promote, and the rewrite of `<id>/index.json` on the `vendored` branch, one commit
// per changed entry, re-signed and self-checked before a push without force. A promotion changes
// only the index, never the vendored set. release.mjs carries the commands; docs/release.md
// describes the gates and the dispatch path.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRANCH, openBranch, ReleaseError } from './branch.mjs';
import { CATALOG, CATALOG_SIG, writeCatalog } from './catalog.mjs';
import { assertSerialAdvances, readIndex, serialize, setChannel, setRevoked, signIndex, verifyIndex } from './index.mjs';
import { trustOf } from './trust.mjs';

export const SOAK_HOURS = 72;
const TRUSTED_AUTHORS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const API = 'https://api.github.com';

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Whether text names `<id> <version>` as a whole token: "acme 1.2" matches "acme 1.2." but not
// "acme 1.20" or "acme 1.2x". The text is matched, never interpreted.
export function namesVersion(text, pack, version) {
  return new RegExp(`(?<![\\w.-])${escape(pack)} ${escape(version)}(?![\\w-]|\\.\\d)`).test(text ?? '');
}

// GitHub's REST API with the job's token; every non-2xx fails, so an unreadable blockers
// repository is an error rather than "no blockers".
// A list follows Link: rel="next" to its last page, and only to a URL on the same API.
export function githubReader({ token, fetch = globalThis.fetch }) {
  const request = async (url) => {
    const res = await fetch(url, {
      headers: { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) throw new ReleaseError(`GET ${url.slice(API.length)}: ${res.status} ${res.statusText} ${(await res.text()).slice(0, 500)}`.trim());
    return res;
  };
  const getAll = async (path) => {
    const items = [];
    for (let url = `${API}${path}`; url;) {
      const res = await request(url);
      items.push(...await res.json());
      url = /<([^>]+)>;\s*rel="next"/.exec(res.headers.get('link') ?? '')?.[1] ?? null;
      if (url && !url.startsWith(`${API}/`)) throw new ReleaseError(`GET ${path}: the next page points off ${API}: ${url}`);
    }
    return items;
  };
  return {
    async openIssues(repo, label) {
      return (await getAll(`/repos/${repo}/issues?labels=${encodeURIComponent(label)}&state=open&per_page=100`)).filter((i) => !i.pull_request);
    },
  };
}

// Soak. indexes: [{pack, index}]. Every canary entry not revoked, as a candidate when it was
// published at least `hours` before now, else declined until then.
export function soak({ indexes, now, hours = SOAK_HOURS }) {
  const candidates = [];
  const declined = [];
  for (const { pack, index } of indexes) {
    for (const e of index.versions.filter((x) => x.channel === 'canary' && x.revoked === false)) {
      const ready = Date.parse(e.publishedAt) + hours * 3600e3;
      if (Number.isNaN(ready)) throw new ReleaseError(`${pack} ${e.version}: publishedAt "${e.publishedAt}" is not a date`);
      if (ready <= now.getTime()) candidates.push({ pack, version: e.version, publishedAt: e.publishedAt });
      else declined.push({ pack, version: e.version, reason: `soaking until ${new Date(ready).toISOString()}` });
    }
  }
  return { candidates, declined };
}

// No blocker. The candidates no open blocker issue by a trusted author names in its title or
// body; the others declined with the issues that block them. config: {repo, label}.
export async function withoutBlockers({ candidates, config, reader }) {
  const issues = (await reader.openIssues(config.repo, config.label)).filter((i) => TRUSTED_AUTHORS.has(i.author_association));
  const clear = [];
  const declined = [];
  for (const c of candidates) {
    const blockers = issues.filter((i) => namesVersion(i.title, c.pack, c.version) || namesVersion(i.body, c.pack, c.version));
    if (blockers.length) declined.push({ pack: c.pack, version: c.version, reason: `blocked by ${blockers.map((b) => `${config.repo}#${b.number}`).join(', ')}` });
    else clear.push(c);
  }
  return { candidates: clear, declined };
}

const VERB = { promote: 'Promote', revoke: 'Revoke' };

// Why this change cannot apply to the entry, or null.
function refusal(change, entry) {
  if (!entry) return `${change.pack} ${change.version} is not in the index`;
  if (change.action === 'promote' && entry.revoked) return `${change.pack} ${change.version} is revoked`;
  if (change.action === 'promote' && entry.channel === 'stable') return `${change.pack} ${change.version} is already stable`;
  if (change.action === 'revoke' && entry.revoked) return `${change.pack} ${change.version} is already revoked`;
  return null;
}

// Applies changes [{pack, version, action, by?}] as one commit each and pushes once. A refused
// change fails the run before anything is pushed, unless skipStale, where it is reported and
// skipped (candidates read before the branch moved). beforePush exists for tests.
export function rewriteBranch({ repo, remote, roots, key, certificate, changes, now, skipStale = false, beforePush, log = () => {} }) {
  const branch = openBranch(repo, remote);
  try {
    const written = [];
    for (const change of changes) {
      const file = join(branch.tree, change.pack, 'index.json');
      if (!existsSync(file)) throw new ReleaseError(`${change.pack} is not on ${BRANCH}`);
      const previousBytes = readFileSync(file);
      trustOf(`${change.pack}/index.json`, previousBytes, join(branch.tree, change.pack, 'index.sig.json'), verifyIndex, { roots, now });
      const previous = readIndex(previousBytes);
      const why = refusal(change, previous.versions.find((e) => e.version === change.version));
      if (why) {
        if (!skipStale) throw new ReleaseError(`refusing to ${change.action}: ${why}`);
        log(`skipped: ${why}`);
        continue;
      }
      const next = change.action === 'promote' ? setChannel(previous, change.version, 'stable') : setRevoked(previous, change.version, true);
      assertSerialAdvances(previous, next);
      const bytes = serialize(next);
      writeFileSync(file, bytes);
      writeFileSync(join(branch.tree, change.pack, 'index.sig.json'), JSON.stringify(signIndex(bytes, key, certificate), null, 2) + '\n');
      const catalogSerial = writeCatalog(branch.tree, key, certificate);
      const message = `${VERB[change.action]} ${change.pack} ${change.version}${change.by ? ` (dispatched by ${change.by})` : ''}`;
      branch.writeBranchCommit([change.pack, CATALOG, CATALOG_SIG], message);
      written.push({ ...change, id: change.pack, serial: next.serial, catalogSerial, message });
      log(message);
    }
    if (!written.length) return written;
    const last = new Map(written.map((w) => [w.id, w.serial]));
    branch.selfCheck([...last].map(([id, serial]) => ({ id, serial })), roots, now, written.at(-1).catalogSerial);
    beforePush?.();
    branch.push();
    log(`pushed ${written.length} commit(s) to ${BRANCH}`);
    return written;
  } finally {
    branch.close();
  }
}
