// The shelf is not a fleet manager (the Engine's pack management design): its own Claudinite
// settings, once it adopts cn, declare no `fleet:` block and no pack from a fleet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SETTINGS = ['settings.yaml', 'settings.yml', 'settings.toml', 'settings.json'].map((f) => join('.claudinite', f));

export function fleetFindings(text) {
  const findings = [];
  if (/^\s*fleet\s*:|^\s*\[fleet[\].]|"fleet"\s*:/m.test(text)) findings.push('a fleet block');
  if (/source\s*[:=]\s*["']?fleet\b/.test(text) || /"source"\s*:\s*"fleet"/.test(text)) findings.push('a pack with source fleet');
  return findings;
}

test('a fleet block or a fleet-sourced pack is found in YAML, TOML and JSON; an ordinary settings file is not', () => {
  assert.deepEqual(fleetFindings('fleet:\n  owner: acme\n'), ['a fleet block']);
  assert.deepEqual(fleetFindings('[fleet]\nowner = "acme"\n'), ['a fleet block']);
  assert.deepEqual(fleetFindings('{"fleet": {"owner": "acme"}}'), ['a fleet block']);
  assert.deepEqual(fleetFindings('packs:\n  declared:\n    - {id: acme-pack, source: fleet}\n'), ['a pack with source fleet']);
  assert.deepEqual(fleetFindings('{"packs": {"declared": [{"id": "acme-pack", "source": "fleet"}]}}'), ['a pack with source fleet']);
  assert.deepEqual(fleetFindings('packs:\n  declared:\n    - basics\n    - {id: acme-pack, source: local}\n'), []);
});

test('the shelf\'s own settings declare no fleet block and no fleet-sourced pack', () => {
  for (const rel of SETTINGS) {
    const file = join(REPO_ROOT, rel);
    if (!existsSync(file)) continue;
    assert.deepEqual(fleetFindings(readFileSync(file, 'utf8')), [], rel);
  }
});
