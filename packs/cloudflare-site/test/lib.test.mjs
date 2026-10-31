import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claimedHostnames, deployedPaths, parseWranglerConfig, publishedDir, stripJsonComments, wranglerConfigPath } from '../lib.mjs';

test('the config is found at the root and one directory down, never deeper', () => {
  assert.equal(wranglerConfigPath(['wrangler.json', 'site/index.html']), 'wrangler.json');
  assert.equal(wranglerConfigPath(['web/wrangler.jsonc']), 'web/wrangler.jsonc');
  assert.equal(wranglerConfigPath(['test/fixtures/demo/wrangler.json']), null);
});

// wrangler prefers .json over .jsonc, and a shallower config over a deeper one; a repo
// carrying both must be read the way wrangler itself reads it, or the release ships a
// tree nobody declared.
test("the config is picked in wrangler's own precedence order", () => {
  assert.equal(wranglerConfigPath(['wrangler.jsonc', 'wrangler.json']), 'wrangler.json');
  assert.equal(wranglerConfigPath(['web/wrangler.json', 'wrangler.jsonc']), 'wrangler.jsonc');
});

test('a JSONC config parses, comments and all', () => {
  const config = parseWranglerConfig(`{
    // the published tree
    "assets": { "directory": "./site" }, /* and nothing else */
    "name": "a // not-a-comment name"
  }`);
  assert.equal(config.assets.directory, './site');
  assert.equal(config.name, 'a // not-a-comment name');
});

test('an unparseable or absent config is null rather than a throw', () => {
  assert.equal(parseWranglerConfig('{ nope'), null);
  assert.equal(parseWranglerConfig(null), null);
});

test('a string ending in a backslash-escaped quote does not swallow the rest of the file', () => {
  assert.equal(stripJsonComments('{"a":"b\\"//c"}'), '{"a":"b\\"//c"}');
});

test('the published tree resolves against the directory holding the config', () => {
  assert.equal(publishedDir({ assets: { directory: './site' } }, 'wrangler.json'), 'site');
  assert.equal(publishedDir({ assets: { directory: 'public/' } }, 'web/wrangler.json'), 'web/public');
  assert.equal(publishedDir({}, 'wrangler.json'), null);
});

test('only the custom-domain routes are claimed hostnames', () => {
  const config = {
    routes: [
      { pattern: 'example.com', custom_domain: true },
      { pattern: 'www.example.com', custom_domain: true },
      { pattern: 'example.com/api/*', zone_name: 'example.com' },
    ],
  };
  assert.deepEqual(claimedHostnames(config), ['example.com', 'www.example.com']);
  assert.deepEqual(claimedHostnames({}), []);
});

test('the deployed paths are the config, the published tree, the Worker folder and the manifests', () => {
  assert.deepEqual(deployedPaths({ main: 'server/index.js', assets: { directory: './site' } }, 'wrangler.json'),
    ['wrangler.json', 'site/', 'server/', 'package.json', 'package-lock.json']);
  assert.deepEqual(deployedPaths({ main: './src/worker.mjs', assets: { directory: 'public/' } }, 'web/wrangler.jsonc'),
    ['web/wrangler.jsonc', 'web/public/', 'web/src/', 'web/package.json', 'web/package-lock.json']);
  // A Worker entry beside the config is one file, not the whole directory.
  assert.deepEqual(deployedPaths({ main: 'index.js', assets: { directory: 'site' } }, 'wrangler.json'),
    ['wrangler.json', 'site/', 'index.js', 'package.json', 'package-lock.json']);
  assert.deepEqual(deployedPaths({ assets: { directory: 'site' } }, 'wrangler.json'),
    ['wrangler.json', 'site/', 'package.json', 'package-lock.json']);
});

// A build fills the published tree from what its `watch_dir` names, resolved from the config's
// folder as wrangler resolves it; an entry may be a file or a folder, so it carries no `/`. Without one, or with one that names the
// whole repo or cannot be read, nothing narrower than every commit covers what ships.
test('a build command adds its watch_dir to the deployed paths', () => {
  assert.deepEqual(deployedPaths({ build: { command: 'python3 build.py', watch_dir: ['web', './studies/', 'build.py'] }, assets: { directory: './out' } }, 'wrangler.json'),
    ['wrangler.json', 'out/', 'package.json', 'package-lock.json', 'web', 'studies', 'build.py']);
  assert.deepEqual(deployedPaths({ build: { command: 'make', watch_dir: '../shared' }, assets: { directory: 'dist' } }, 'site/wrangler.json'),
    ['site/wrangler.json', 'site/dist/', 'site/package.json', 'site/package-lock.json', 'shared']);
});

test('a build command with no usable watch_dir has no deployed paths to name', () => {
  for (const watch of [undefined, '', ['web', '  '], [], ['web', 7], '.', ['web', './'], '../..']) {
    assert.equal(deployedPaths({ build: { command: 'python3 build.py', watch_dir: watch }, assets: { directory: './out' } }, 'wrangler.json'), null, String(watch));
  }
});

// wrangler reads watch_dir only beside a command, and an empty command builds nothing.
test('watch_dir without a build command changes nothing', () => {
  for (const command of [undefined, '  ']) {
    assert.deepEqual(deployedPaths({ build: { command, watch_dir: 'web' }, assets: { directory: 'site' } }, 'wrangler.json'),
      ['wrangler.json', 'site/', 'package.json', 'package-lock.json']);
  }
});
