import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sourceModule} from './load-source.mjs';
import {allowedSender, validateSearch, destination} from '../extension/policy.js';
import {platforms as snapshot} from '../extension/platforms.js';
const {googleQuery, platforms} = await import(sourceModule('../lib/search.ts'));
assert.deepEqual(snapshot, platforms.map(({id, name, domains}) => ({id, name, domains})));
const input = {keywords: 'engineer', location: 'Germany', remote: false, platforms: ['lever', 'ashby']};
const query = googleQuery(input);
assert.match(query, /^\(site:jobs\.lever\.co OR site:jobs\.eu\.lever\.co OR site:jobs\.ashbyhq\.com\) /);
assert.equal(validateSearch({query, platforms: input.platforms}).query, query);
assert.throws(() => validateSearch({query, platforms: ['lever']}), /combined query/);
assert.throws(() => validateSearch({query, platforms: ['unknown']}), /valid ATS/);
assert.throws(() => validateSearch({query: query + '\n', platforms: input.platforms}), /combined query/);
assert.equal(allowedSender({frameId: 0, url: 'http://127.0.0.1:5173/prototype'}), true);
for (const url of ['http://127.0.0.1:5174/prototype', 'https://evil.example/', 'http://localhost.evil.example:5173/'])
  assert.equal(allowedSender({frameId: 0, url}), false);
assert.equal(allowedSender({frameId: 1, url: 'http://127.0.0.1:5173/prototype'}), false);
assert.deepEqual(destination('https://jobs.ashbyhq.com/example/job?utm_source=google#section', ['ashby']), {url: 'https://jobs.ashbyhq.com/example/job', platform: 'ashby'});
for (const url of ['javascript:alert(1)', 'http://jobs.ashbyhq.com/x', 'https://jobs.ashbyhq.com.evil.example/x', 'https://user@jobs.ashbyhq.com/x', 'https://jobs.lever.co/x'])
  assert.equal(destination(url, ['ashby']), null);
assert.equal(destination('https://company.bamboohr.com/careers/1', ['bamboohr']).platform, 'bamboohr');
assert.equal(destination('https://company.bamboohr.com/careers-evil/1', ['bamboohr']), null);
const manifest = JSON.parse(readFileSync(new URL('../extension/manifest.json', import.meta.url)));
assert.deepEqual(manifest.permissions, ['scripting', 'storage']);
assert.deepEqual(manifest.host_permissions, ['https://www.google.com/*']);
assert.equal(manifest.manifest_version, 3);
console.log('Extension boundary, combined-query and destination checks passed. No live retrieval is simulated.');
