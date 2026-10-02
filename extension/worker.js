import {allowedSender, validateSearch, destination, nextPage} from './policy.js';
import {extractGoogle} from './extract.js';
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
    const timer = setTimeout(() => finish(new Error('Google did not finish loading within 20 seconds. Open the helper tab to inspect it. No automatic retry was made.')), 20000);
    chrome.tabs.onUpdated.addListener(updated); chrome.tabs.onRemoved.addListener(removed);
    chrome.tabs.update(tabId, {url, active: false}).catch(finish);
  });
}
async function search(message, owner) {
  const key = 'search:' + owner;
  let input, url, pages;
  if (message.type === 'load-more') {
    const saved = (await chrome.storage.session.get(key))[key];
    if (!saved || typeof message.token !== 'string' || message.token !== saved.token || !saved.nextPage)
      throw new Error('This next page is no longer available. Start a new Search.');
    input = validateSearch(saved);
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
  if (result.blocked) return {type: 'blocked', error: 'Google requires consent or verification. Open the helper tab and handle it manually, then repeat your Search or Load more action.'};
  if (!Array.isArray(result.results) || !result.results.length)
    return {type: 'error', error: 'No readable result cards were found. Google may have no matches or its page structure may be unsupported. Open the helper tab to inspect the result.'};
  const seen = new Set();
  const results = result.results.flatMap(row => {
    const target = destination(row.url, input.platforms);
    if (!target || seen.has(target.url)) return [];
    seen.add(target.url); return [{...target, title: row.title, snippet: row.snippet}];
  }).slice(0,20);
  const saved = {...input, nextPage: nextPage(result.nextPage, input.query, url), token: crypto.randomUUID(), pages};
  // Persist the cursor before closing our tab. It survives service-worker idle.
  await chrome.storage.session.set({[key]: saved});
  let warning;
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
    if (!['search', 'load-more'].includes(message.type)) return;
    if (busy) { reply({id, type: 'error', error: 'Another search is still running. Wait for it to finish, then click Search.'}); return; }
    busy = true;
    try { reply({id, ...await search(message, owner)}); }
    catch (error) { reply({id, type: 'error', error: error instanceof Error ? error.message : 'Extension retrieval failed.'}); }
    finally { busy = false; }
  });
});
