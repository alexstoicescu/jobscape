import {allowedSender, validateSearch, destination, nextPage} from './policy.js';
import {extractGoogle} from './extract.js';
import {extractPosting} from './extract-posting.js';
const protocol = 'jobscape-extension-v1';
let busy = false;
async function helper(owner) {
  const {helperId} = await chrome.storage.session.get('helperId');
  if (Number.isInteger(helperId)) {
    try {
      const tab = await chrome.tabs.get(helperId);
      await chrome.storage.session.set({helperOwner: owner});
      return tab;
    } catch { /* User closed our helper. */ }
  }
  const tab = await chrome.tabs.create({url: 'about:blank', active: false});
  await chrome.storage.session.set({helperId: tab.id, helperOwner: owner});
  return tab;
}
function navigate(tabId, url) {
  return new Promise((resolve, reject) => {
    const finish = error => {
      clearTimeout(timer); chrome.tabs.onUpdated.removeListener(updated); chrome.tabs.onRemoved.removeListener(removed);
      error ? reject(error) : resolve();
    };
    const updated = (id, change) => { if (id === tabId && change.status === 'complete') finish(); };
    const removed = id => { if (id === tabId) finish(new Error('Helper tab was closed.')); };
    const timer = setTimeout(() => finish(new Error('The requested page did not finish loading within 20 seconds. No automatic retry was made.')), 20000);
    chrome.tabs.onUpdated.addListener(updated); chrome.tabs.onRemoved.addListener(removed);
    chrome.tabs.update(tabId, {url, active: false}).catch(finish);
  });
}
async function checkPosting(message, owner) {
  if (typeof message.url !== 'string' || message.url.length > 4000 || typeof message.platform !== 'string')
    throw new Error('Invalid posting request.');
  const target = destination(message.url, [message.platform]);
  if (!target) throw new Error('Posting is outside the configured ATS domains.');
  const {descriptions = {}} = await chrome.storage.session.get('descriptions');
  const now = Date.now();
  const existing = descriptions[target.url];
  if (existing && now - existing.checkedAt < 30 * 60 * 1000)
    return {type: 'posting', url: target.url, posting: existing.posting, checkedAt: existing.checkedAt, cached: true};
  const tab = await helper(owner);
  let response;
  try {
    await navigate(tab.id, target.url);
    const loaded = await chrome.tabs.get(tab.id);
    if (!loaded.url || destination(loaded.url, [message.platform])?.url !== target.url)
      throw new Error('The posting redirected or requires access. Remote eligibility is Unknown.');
    const [{result}] = await chrome.scripting.executeScript({target: {tabId: tab.id}, func: extractPosting});
    if (!result || result.error) throw new Error(result?.error ?? 'The posting could not be read.');
    // Cache only explicit successful reads, with a 2 MB/10-entry session budget.
    const cache = Object.fromEntries(Object.entries(descriptions).filter(([, entry]) => now - entry.checkedAt < 30 * 60 * 1000));
    cache[target.url] = {posting: result, checkedAt: now};
    const entries = Object.entries(cache).sort((a,b) => b[1].checkedAt - a[1].checkedAt).slice(0,10);
    while (entries.length && JSON.stringify(Object.fromEntries(entries)).length * 2 > 2 * 1024 * 1024) entries.pop();
    await chrome.storage.session.set({descriptions: Object.fromEntries(entries)});
    response = {type: 'posting', url: target.url, posting: result, checkedAt: now, cached: false};
  } finally {
    // Posting checks close our tab even on Unknown/inaccessible results. Search
    // consent helpers retain their existing behavior and pagination is untouched.
    const {helperId, helperOwner} = await chrome.storage.session.get(['helperId','helperOwner']);
    if (helperId === tab.id && helperOwner === owner) {
      try {await chrome.tabs.remove(tab.id); await chrome.storage.session.remove(['helperId','helperOwner']);}
      catch {if (response) response.warning = 'Posting checked, but the owned helper could not be closed.';}
    }
  }
  return response;
}
async function search(message, owner) {
  const key = 'search:' + owner;
  let input, url, pages, previous;
  if (message.type === 'load-more') {
    const saved = (await chrome.storage.session.get(key))[key];
    if (!saved || typeof message.token !== 'string' || message.token !== saved.token || !saved.nextPage)
      throw new Error('This next page is no longer available. Start a new Search.');
    input = validateSearch(saved);
    previous = saved;
    url = saved.nextPage;
    pages = saved.pages + 1;
  } else {
    input = validateSearch(message);
    url = 'https://www.google.com/search?' + new URLSearchParams({q: input.query});
    pages = 1;
    // Invalidate the previous query's cursor even if this new search fails.
    await chrome.storage.session.remove(key);
  }
  const tab = await helper(owner);
  await navigate(tab.id, url); // One navigation per explicit Search/Load more.
  const loaded = await chrome.tabs.get(tab.id);
  if (!loaded.url || new URL(loaded.url).origin !== 'https://www.google.com')
    return {type: 'blocked', error: 'Google redirected or requires consent. Open the helper tab and handle it manually, then repeat your Search or Load more action.'};
  const actual = new URL(loaded.url);
  if (actual.pathname !== '/search' || actual.searchParams.get('q') !== input.query ||
      Number(actual.searchParams.get('start') ?? 0) !== Number(new URL(url).searchParams.get('start') ?? 0))
    return {type: 'blocked', error: 'The helper is not on the requested results page. Open it to handle any verification, then repeat your Search or Load more action.'};
  const [{result}] = await chrome.scripting.executeScript({target: {tabId: tab.id}, func: extractGoogle});
  if (result?.blocked) return {type: 'blocked', error: 'Google requires consent or verification. Open the helper tab and handle it manually, then repeat your Search or Load more action.'};
  if (!result || result.error || !Array.isArray(result.results) || !result.results.length && !result.empty)
    return {type: 'error', error: result?.error ?? 'Google result extraction failed; exhaustion is not confirmed. Open the helper tab to inspect it.'};
  const raw = await Promise.all(result.results.map(async row => {
    const u = new URL(row.url); u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (/^(utm_|gclid$|fbclid$)/i.test(key)) u.searchParams.delete(key);
    u.searchParams.sort();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(u.href));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,'0')).join('');
  }));
  const prior = new Set(previous?.rawSeen ?? []);
  const fresh = raw.some(key => !prior.has(key));
  const rawSeen = [...new Set([...prior, ...raw])];
  const exhausted = !raw.length || !fresh;
  const seen = new Set();
  const results = result.results.flatMap(row => {
    const target = destination(row.url, input.platforms);
    if (!target || seen.has(target.url)) return [];
    seen.add(target.url); return [{...target, title: row.title, snippet: row.snippet}];
  }).slice(0,20);
  const actualNext = nextPage(result.nextPage, input.query, url);
  const fallback = new URL(url); fallback.searchParams.set('start', String(Number(fallback.searchParams.get('start') ?? 0) + 10));
  const limited = rawSeen.length >= 5000;
  const saved = {...input, rawSeen:rawSeen.slice(0,5000), nextPage: exhausted || limited ? null : actualNext ?? fallback.href, token: crypto.randomUUID(), pages};
  // Persist the cursor before closing our tab. It survives service-worker idle.
  await chrome.storage.session.set({[key]: saved});
  let warning = exhausted ? 'Pagination stopped: empty or repeated raw Google results.' : limited ? 'Pagination stopped at the 5,000 raw-URL history limit.' : !actualNext ? 'No actual next/numbered link found. Load more will make one next-offset attempt with the submitted query.' : undefined;
  const {helperId, helperOwner} = await chrome.storage.session.get(['helperId', 'helperOwner']);
  if (helperId === tab.id && helperOwner === owner) {
    try {
      await chrome.tabs.remove(tab.id);
      await chrome.storage.session.remove(['helperId', 'helperOwner']);
    } catch { warning = 'Results loaded, but the helper tab could not be closed. You can close it manually.'; }
  }
  return {type: 'results', query: input.query, results, pagination: {token: saved.token, hasMore: saved.nextPage !== null, pages}, warning};
}
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== protocol || !allowedSender(port.sender) || !Number.isInteger(port.sender.tab?.id)) { port.disconnect(); return; }
  const owner = port.sender.tab.id;
  const reply = message => { try { port.postMessage(message); } catch { /* Page disconnected. */ } };
  port.onMessage.addListener(async message => {
    if (!message || typeof message.id !== 'string' || message.id.length > 80) return;
    const id = message.id;
    if (message.type === 'ping') { reply({id, type: 'ready'}); return; }
    if (message.type === 'open-helper') {
      const {helperId, helperOwner} = await chrome.storage.session.get(['helperId', 'helperOwner']);
      try { if (!Number.isInteger(helperId) || helperOwner !== owner) throw new Error(); await chrome.tabs.update(helperId, {active: true}); reply({id, type: 'opened'}); }
      catch { reply({id, type: 'error', error: 'There is no helper tab yet. Click Search first.'}); }
      return;
    }
    if (!['search', 'load-more', 'check-posting'].includes(message.type)) return;
    if (busy) { reply({id, type: 'error', error: 'Another search is still running. Wait for it to finish, then click Search.'}); return; }
    busy = true;
    try { reply({id, ...await (message.type === 'check-posting' ? checkPosting(message, owner) : search(message, owner))}); }
    catch (error) { reply({id, type: 'error', error: error instanceof Error ? error.message : 'Extension retrieval failed.'}); }
    finally { busy = false; }
  });
});
