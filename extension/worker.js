import {allowedSender, validateSearch, destination} from './policy.js';
import {extractGoogle} from './extract.js';
const protocol = 'jobscape-extension-v1';
let busy = false;
async function helper() {
  const {helperId} = await chrome.storage.session.get('helperId');
  if (Number.isInteger(helperId)) {
    try { return await chrome.tabs.get(helperId); } catch { /* User closed our helper. */ }
  }
  const tab = await chrome.tabs.create({url: 'about:blank', active: false});
  await chrome.storage.session.set({helperId: tab.id});
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
async function search(message) {
  const input = validateSearch(message);
  const tab = await helper();
  const url = 'https://www.google.com/search?' + new URLSearchParams({q: input.query});
  await navigate(tab.id, url); // Exactly one navigation for the combined query.
  const loaded = await chrome.tabs.get(tab.id);
  if (!loaded.url || new URL(loaded.url).origin !== 'https://www.google.com')
    return {type: 'blocked', error: 'Google redirected or requires consent. Open the helper tab and handle it manually, then click Search again.'};
  const [{result}] = await chrome.scripting.executeScript({target: {tabId: tab.id}, func: extractGoogle});
  if (result.blocked) return {type: 'blocked', error: 'Google requires consent or verification. Open the helper tab and handle it manually, then click Search again.'};
  const seen = new Set();
  const results = result.results.flatMap(row => {
    const target = destination(row.url, input.platforms);
    if (!target || seen.has(target.url)) return [];
    seen.add(target.url); return [{...target, title: row.title, snippet: row.snippet}];
  }).slice(0,20);
  if (!results.length) return {type: 'error', error: 'No readable selected-ATS result cards were found. Google may have no matches or its page structure may be unsupported. Open the helper tab to inspect the result.'};
  return {type: 'results', query: input.query, results};
}
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== protocol || !allowedSender(port.sender)) { port.disconnect(); return; }
  const reply = message => { try { port.postMessage(message); } catch { /* Page disconnected. */ } };
  port.onMessage.addListener(async message => {
    if (!message || typeof message.id !== 'string' || message.id.length > 80) return;
    const id = message.id;
    if (message.type === 'ping') { reply({id, type: 'ready'}); return; }
    if (message.type === 'open-helper') {
      const {helperId} = await chrome.storage.session.get('helperId');
      try { if (!Number.isInteger(helperId)) throw new Error(); await chrome.tabs.update(helperId, {active: true}); reply({id, type: 'opened'}); }
      catch { reply({id, type: 'error', error: 'There is no helper tab yet. Click Search first.'}); }
      return;
    }
    if (message.type !== 'search') return;
    if (busy) { reply({id, type: 'error', error: 'Another search is still running. Wait for it to finish, then click Search.'}); return; }
    busy = true;
    try { reply({id, ...await search(message)}); }
    catch (error) { reply({id, type: 'error', error: error instanceof Error ? error.message : 'Extension retrieval failed.'}); }
    finally { busy = false; }
  });
});
