import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {sourceModule} from './load-source.mjs';
import {allowedSender, validateSearch, destination, nextPage} from '../extension/policy.js';
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
assert.deepEqual(manifest.host_permissions, ['https://www.google.com/*', ...new Set(platforms.flatMap(p => p.domains).map(domain => {
  const [host, ...path] = domain.split('/'); return 'https://*.' + host + '/' + (path.length ? path.join('/') + '*' : '*');
}))]);
assert.equal(manifest.manifest_version, 3);
const first = 'https://www.google.com/search?' + new URLSearchParams({q: query});
const next = first + '&start=10';
assert.equal(nextPage(next, query, first), next);
assert.equal(nextPage(null, query, first), null);
for (const url of [next.replace('www.google.com', 'evil.example'), first, next.replace('start=10', 'start=0'), next.replace('start=10', 'start=abc'), 'https://www.google.com/search?q=other&start=10'])
  assert.throws(() => nextPage(url, query, first), /next-page link/);

const event = () => {
  const listeners = new Set();
  return {addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn), fire: (...args) => [...listeners].forEach(fn => fn(...args))};
};
// Execute the real bridge with an idle/disconnected transport. Every user
// request opens one fresh port, posts once and closes after its own reply.
let receiver;
const ports = [], replies = [];
const fakeWindow = {addEventListener: (_, fn) => {receiver = fn;}, postMessage: m => replies.push(m)};
vm.runInNewContext(readFileSync(new URL('../extension/bridge.js', import.meta.url), 'utf8'), {
  window: fakeWindow, location: {origin: 'http://127.0.0.1:5173'}, chrome: {runtime: {connect: () => {
    const port = {onMessage: event(), onDisconnect: event(), posted: [], postMessage: m => port.posted.push(m), disconnect: () => port.onDisconnect.fire()};
    ports.push(port); return port;
  }}}
});
const dispatch = (id, type) => receiver({source: fakeWindow, origin: 'http://127.0.0.1:5173', data: {protocol: 'jobscape-extension-v1', direction: 'request', id, type}});
dispatch('old', 'ping'); ports[0].onMessage.fire({id: 'old', type: 'ready'});
dispatch('fresh', 'search');
assert.equal(ports.length, 2);
assert.equal(ports[1].posted.length, 1);
ports[1].onDisconnect.fire();
assert.equal(replies.at(-1).id, 'fresh');
assert.equal(replies.at(-1).type, 'error');
dispatch('reconnect', 'search');
assert.equal(ports.length, 3);
assert.equal(ports[2].posted.length, 1); // No retransmission of uncertain requests.
ports[2].onMessage.fire({id: 'reconnect', type: 'results'});
assert.equal(replies.at(-1).type, 'results');

// Exercise the actual worker state machine with Chrome API fixtures. This
// proves ownership/order/state behavior, not real Google DOM compatibility.
const storage = {}, tabs = new Map([[42, {id: 42, url: 'http://127.0.0.1:5173/prototype', active: true}], [777, {id: 777, url: 'https://unrelated.example', active: false}]]);
const actions = [];
let tabId = 100, extraction;
const chrome = {
  storage: {session: {
    get: async keys => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, storage[key]])),
    set: async values => {actions.push(['save', ...Object.keys(values)]); Object.assign(storage, structuredClone(values));},
    remove: async keys => {for (const key of Array.isArray(keys) ? keys : [keys]) delete storage[key];}
  }},
  tabs: {
    onUpdated: event(), onRemoved: event(),
    get: async id => {if (!tabs.has(id)) throw new Error('Closed'); return tabs.get(id);},
    create: async options => {const tab = {id: ++tabId, ...options}; tabs.set(tab.id, tab); actions.push(['create', tab.id, options.active]); return tab;},
    update: async (id, options) => {Object.assign(tabs.get(id), options); actions.push(['update', id, options.url, options.active]); if (options.url) queueMicrotask(() => chrome.tabs.onUpdated.fire(id, {status: 'complete'})); return tabs.get(id);},
    remove: async id => {actions.push(['close', id]); assert.ok(storage['search:42'], 'Pagination saved before close'); tabs.delete(id); chrome.tabs.onRemoved.fire(id);}
  },
  scripting: {executeScript: async () => [{result: await extraction()}]},
  runtime: {onConnect: event()}
};
const worker = readFileSync(new URL('../extension/worker.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
function restartWorker() {
  chrome.runtime.onConnect = event();
  vm.runInNewContext(worker, {chrome, allowedSender, validateSearch, destination, nextPage, extractGoogle: () => {}, extractPosting: () => {}, crypto: webcrypto, URL, URLSearchParams, setTimeout, clearTimeout});
}
function request(message, owner = 42) {
  let handler, response;
  const port = {name: 'jobscape-extension-v1', sender: {frameId: 0, url: 'http://127.0.0.1:5173/prototype', tab: {id: owner}},
    onMessage: {addListener: fn => {handler = fn;}}, postMessage: reply => {response = reply;}, disconnect: () => {}};
  chrome.runtime.onConnect.fire(port);
  return Promise.resolve(handler(message)).then(() => response);
}
const rows = [{title: 'Engineer', snippet: 'Source snippet', url: 'https://jobs.ashbyhq.com/example/one'}, {title: 'Duplicate', snippet: '', url: 'https://jobs.ashbyhq.com/example/one?utm_source=google'}];
restartWorker();
extraction = async () => ({blocked: false, results: rows, nextPage: next});
const pageOne = await request({id: 'one', type: 'search', query, platforms: input.platforms});
assert.equal(pageOne.type, 'results'); assert.equal(pageOne.results.length, 1); assert.equal(pageOne.pagination.hasMore, true);
assert.equal(tabs.size, 2); assert.equal(tabs.get(42).active, true); assert.ok(tabs.has(777));
assert.ok(actions.findIndex(a => a[0] === 'save' && a.includes('search:42')) < actions.findIndex(a => a[0] === 'close'));
assert.ok(actions.filter(a => a[0] === 'update').every(a => a[3] === false));
const oldToken = pageOne.pagination.token;
restartWorker(); // No in-memory query/tab state survives idle/restart.
extraction = async () => ({blocked: true, results: []});
const blocked = await request({id: 'blocked', type: 'load-more', token: oldToken});
assert.equal(blocked.type, 'blocked'); assert.equal(storage['search:42'].token, oldToken);
const retained = storage.helperId;
assert.ok(tabs.has(retained));
await request({id: 'foreign', type: 'open-helper'}, 99);
assert.equal(tabs.get(retained).active, false); // Another JobScape tab cannot open it.
extraction = async () => ({blocked: false, results: [{...rows[0], url: 'https://jobs.ashbyhq.com/example/two'}], nextPage: null});
const pageTwo = await request({id: 'two', type: 'load-more', token: oldToken});
assert.equal(pageTwo.type, 'results'); assert.equal(pageTwo.pagination.pages, 2); assert.equal(pageTwo.pagination.hasMore, false);
assert.equal(actions.filter(a => a[0] === 'update' && a[2]).at(-1)[2], next); // Google's saved URL, not a synthesized offset.
assert.equal(tabs.size, 2); assert.equal(storage.helperId, undefined);
const count = actions.length;
assert.equal((await request({id: 'replay', type: 'load-more', token: oldToken})).type, 'error');
assert.equal(actions.length, count); // No navigation after cursor exhaustion/replay.
let release, entered;
const enteredExtraction = new Promise(resolve => {entered = resolve;});
extraction = () => {entered(); return new Promise(resolve => {release = resolve;});};
const pending = request({id: 'pending', type: 'search', query, platforms: input.platforms});
await enteredExtraction;
const duplicate = await request({id: 'duplicate', type: 'search', query, platforms: input.platforms});
assert.equal(duplicate.type, 'error'); assert.match(duplicate.error, /still running/);
release({blocked: false, results: rows, nextPage: null}); await pending;
assert.ok(actions.filter(a => a[0] === 'close').every(a => a[1] !== 42 && a[1] !== 777));
const cursor = JSON.stringify(storage['search:42']);
const postingUrl = 'https://jobs.ashbyhq.com/example/one';
extraction = async () => ({title: 'Engineer', text: 'Fully remote worldwide.', blocks: [], links: [], locations: [], requirements: [], remote: true, truncated: false, method: 'structured'});
const posting = await request({id: 'posting', type: 'check-posting', url: postingUrl, platform: 'ashby'});
assert.equal(posting.type, 'posting'); assert.equal(posting.cached, false);
assert.equal(tabs.size, 2); assert.equal(JSON.stringify(storage['search:42']), cursor);
assert.ok(actions.findIndex(a => a[0] === 'save' && a.includes('descriptions')) < actions.findLastIndex(a => a[0] === 'close'));
const afterRead = actions.length;
restartWorker();
assert.equal((await request({id: 'cached', type: 'check-posting', url: postingUrl, platform: 'ashby'})).cached, true);
assert.equal(actions.length, afterRead, 'Cached reads do not open or navigate tabs');
extraction = async () => ({error: 'Posting requires access or verification.'});
assert.equal((await request({id: 'inaccessible', type: 'check-posting', url: postingUrl + '2', platform: 'ashby'})).type, 'error');
assert.equal(tabs.size, 2); assert.equal(JSON.stringify(storage['search:42']), cursor);
const afterFailure = actions.length;
assert.equal((await request({id: 'unsafe', type: 'check-posting', url: 'https://evil.example/', platform: 'ashby'})).type, 'error');
assert.equal(actions.length, afterFailure);
console.log('Extension checks passed: search/reconnect/pagination, URL boundaries, posting cache across idle, save-before-close, failure cleanup and unchanged search cursor. Chrome remains manual validation.');
