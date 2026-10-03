import {destination} from '../extension/policy.js';
import type {Posting} from './remote-eligibility';
import {matchesGoogleTitle, type SearchInput} from './search';
export type GoogleCard = {title: string; snippet: string; url: string; platform: string};
export function checkedPosting(response: Record<string, unknown>, card: GoogleCard): Posting {
  const posting = response.posting as Posting | undefined;
  if (response.type !== 'posting' || response.url !== card.url || !posting ||
      typeof posting.title !== 'string' || posting.title.length > 500 || typeof posting.text !== 'string' || posting.text.length > 100000 ||
      typeof posting.truncated !== 'boolean' || !['structured','page'].includes(posting.method) ||
      posting.remote !== null && typeof posting.remote !== 'boolean' ||
      ![posting.locations, posting.requirements].every(values => Array.isArray(values) && values.length <= 50 && values.every(value => typeof value === 'string' && value.length <= 300)))
    throw new Error('Invalid full-posting response. Remote eligibility is Unknown.');
  return posting;
}
const protocol = 'jobscape-extension-v1';
export function extensionRequest(type: 'ping' | 'search' | 'load-more' | 'check-posting' | 'open-helper', data: {query?: string; platforms?: string[]; token?: string; url?: string; platform?: string} = {}) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const id = crypto.randomUUID();
    const cleanup = () => { clearTimeout(timer); window.removeEventListener('message', receive); };
    const receive = (event: MessageEvent) => {
      const m = event.data;
      if (event.source !== window || event.origin !== location.origin || !m ||
          m.protocol !== protocol || m.direction !== 'response' || m.id !== id) return;
      cleanup();
      if (m.type === 'error' || m.type === 'blocked') reject(new Error(typeof m.error === 'string' ? m.error.slice(0,1000) : 'Extension retrieval failed.'));
      else resolve(m);
    };
    const timer = setTimeout(() => { cleanup(); reject(new Error(type === 'ping' ? 'Extension missing or disconnected. Enable it in Chrome, then click Search to reconnect.' : 'Extension did not respond. No automatic retry was made.')); }, type === 'ping' ? 5000 : type === 'check-posting' ? 35000 : 25000);
    window.addEventListener('message', receive);
    window.postMessage({protocol, direction: 'request', id, type, ...data}, location.origin);
  });
}
export type Pagination = {token: string; hasMore: boolean; pages: number};
export function paginationState(response: Record<string, unknown>): Pagination {
  const page = response.pagination as Partial<Pagination> | undefined;
  if (!page || typeof page.token !== 'string' || !/^[a-f0-9-]{36}$/.test(page.token) ||
      typeof page.hasMore !== 'boolean' || typeof page.pages !== 'number' || !Number.isSafeInteger(page.pages) || page.pages < 1)
    throw new Error('Invalid extension pagination state.');
  return page as Pagination;
}
export function resultCards(response: Record<string, unknown>, query: string, ids: string[], input: SearchInput): GoogleCard[] {
  if (response.type !== 'results' || response.query !== query || !Array.isArray(response.results) || response.results.length > 20)
    throw new Error('Invalid extension result response.');
  const seen = new Set<string>();
  return response.results.map(row => {
    if (!row || typeof row !== 'object' || typeof row.title !== 'string' || !row.title.trim() || row.title.length > 500 ||
        typeof row.snippet !== 'string' || row.snippet.length > 2000 || typeof row.url !== 'string') throw new Error('Invalid result card.');
    const target = destination(row.url, ids);
    if (!target || target.platform !== row.platform) throw new Error('Result destination is outside the selected ATS domains.');
    return {title: row.title, snippet: row.snippet, ...target};
  }).filter(row => { if (seen.has(row.url)) return false; seen.add(row.url); return matchesGoogleTitle(row.title, input); });
}
