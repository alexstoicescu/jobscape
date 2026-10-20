import {googleQuery, validateInput, matchesGoogleTitle} from './search';
import {atsPosting, type Candidate, type DiscoveryInput, type DiscoveryPage} from './discovery';
import {verifyGlobalPage} from './global-page';

export type SerperEnv = {
  JOBSCAPE_DISCOVERY?: string; SERPER_API_KEY?: string; SERPER_DB?: D1Database;
  SERPER_SEARCH_LIMIT?: string; SERPER_DAILY_LIMIT?: string; SERPER_MONTHLY_LIMIT?: string; SERPER_TOTAL_LIMIT?: string;
};
export class DiscoveryError extends Error {
  constructor(public code: string, message: string, public status = 503) {super(message);}
}
type Organic = {title: string; snippet?: string; link: string};
type ProviderPage = {organic: Organic[]; credits: number | null};
const integer = (value: string | undefined, fallback: number, max: number) => {
  if (value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(value) || Number(value) > max) throw new DiscoveryError('configuration', 'Search usage limits are not configured correctly.');
  return Number(value);
};
export function limits(env: SerperEnv) {
  return {search: integer(env.SERPER_SEARCH_LIMIT, 4, 10), daily: integer(env.SERPER_DAILY_LIMIT, 20, 1000),
    monthly: integer(env.SERPER_MONTHLY_LIMIT, 200, 2500), total: integer(env.SERPER_TOTAL_LIMIT, 2000, 2500)};
}
export function discoverySpec(value: unknown): DiscoveryInput {
  const v = value as Partial<DiscoveryInput> | null;
  if (!v || !['All','Global','EU','EMEA','APAC','US'].includes(v.region ?? '')) throw new DiscoveryError('input', 'Choose a valid search region.', 400);
  let input;
  try {input = validateInput(v.input);} catch (e) {throw new DiscoveryError('input', e instanceof Error ? e.message : 'Invalid search.', 400);}
  if (/[\x00-\x1f]/.test(input.keywords + input.location)) throw new DiscoveryError('input', 'Remove control characters from the search.', 400);
  return {input, region: v.region as DiscoveryInput['region']};
}

export async function fetchSerper(query: string, page: number, key: string, fetcher: typeof fetch = fetch): Promise<ProviderPage> {
  try {
    const response = await fetcher('https://google.serper.dev/search', {method: 'POST', redirect: 'manual',
      headers: {'X-API-KEY': key, 'Content-Type': 'application/json'},
      body: JSON.stringify({q: query, gl: 'de', hl: 'en', num: 10, page, autocorrect: false}), signal: AbortSignal.timeout(15000)});
    if (response.status === 402 || response.status === 429) throw new DiscoveryError('provider_quota', 'Search provider credits or rate limit exhausted. No automatic retry was made.', 429);
    if (response.status === 401 || response.status === 403) {
      // Serper can report exhausted credits as 403. Classify its known wording
      // without exposing the response body or treating all 403s as quota errors.
      const reason = (await response.text()).slice(0,4096);
      if (/not enough credits|insufficient credits|credits exhausted|quota exceeded/i.test(reason))
        throw new DiscoveryError('provider_quota', 'Search provider credits exhausted. No automatic retry was made.', 429);
      throw new DiscoveryError('provider_auth', 'The server search credential was rejected. Contact the site owner.');
    }
    if (!response.ok) throw new DiscoveryError('provider_failed', 'The search provider failed. This is not an empty results page.', 502);
    const text = await response.text();
    if (text.length > 150000) throw new DiscoveryError('provider_format', 'The provider response exceeded the supported size.', 502);
    let data;
    try {data = JSON.parse(text);} catch {throw new DiscoveryError('provider_format', 'The provider returned unreadable data.', 502);}
    if (!data || !Array.isArray(data.organic) || data.organic.length > 20 ||
        data.organic.some((r: Organic) => !r || typeof r.title !== 'string' || !r.title.trim() || r.title.length > 500 ||
          typeof r.link !== 'string' || r.snippet !== undefined && (typeof r.snippet !== 'string' || r.snippet.length > 2000)) ||
        data.searchParameters?.q !== undefined && data.searchParameters.q !== query)
      throw new DiscoveryError('provider_format', 'The provider did not return a valid organic results page. This is not zero jobs.', 502);
    return {organic: data.organic, credits: typeof data.credits === 'number' ? data.credits : null};
  } catch (e) {
    if (e instanceof DiscoveryError) throw e;
    if (e instanceof Error && ['TimeoutError','AbortError'].includes(e.name)) throw new DiscoveryError('provider_timeout', 'The search provider exceeded 15 seconds. Its credit may still be consumed. No automatic retry was made.', 504);
    // Operational diagnostics omit headers/body and redact the credential even
    // if a runtime unexpectedly includes it in a transport exception.
    if (e instanceof Error) console.warn('Serper transport failure:', e.name, e.message.replaceAll(key,'[REDACTED]').slice(0,200));
    // Never return raw upstream/network errors: they can contain request secrets.
    throw new DiscoveryError('provider_failed', 'The search provider could not be reached. This is not zero jobs.', 502);
  }
}

export function candidatePage(data: ProviderPage, spec: DiscoveryInput, prior: string[]) {
  const seen = new Set(prior), rawKeys: string[] = [], results: Candidate[] = [];
  let rejected = 0, duplicates = 0;
  for (const row of data.organic) {
    const target = atsPosting(row.link, spec.input.platforms);
    // Raw URL identities determine exhaustion, independently of title validation.
    const key = target?.key ?? 'raw:' + row.link;
    rawKeys.push(key);
    if (seen.has(key)) {duplicates++; continue;}
    seen.add(key);
    if (!target || !matchesGoogleTitle(row.title, spec.input)) {rejected++; continue;}
    results.push({title: row.title, snippet: row.snippet ?? '', ...target});
  }
  return {results, rejected, duplicates, seen: [...seen], rawCount: data.organic.length,
    exhausted: data.organic.length === 0 || rawKeys.every(key => prior.includes(key))};
}

export async function discovery(body: unknown, env: SerperEnv, fetcher: typeof fetch = fetch): Promise<DiscoveryPage> {
  if (env.JOBSCAPE_DISCOVERY !== 'serper') throw new DiscoveryError('disabled', 'Serper discovery is disabled on this server.');
  if (!env.SERPER_API_KEY?.trim()) throw new DiscoveryError('missing_key', 'The server search key is missing. No provider request was made.');
  if (!env.SERPER_DB) throw new DiscoveryError('usage_store', 'Search is blocked until the shared usage database is configured.');
  const db = env.SERPER_DB, cap = limits(env);
  const v = body as {session?: unknown; page?: unknown; spec?: unknown} | null;
  if (!v || typeof v.session !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v.session) ||
      !Number.isSafeInteger(v.page) || Number(v.page) < 1 || Number(v.page) > 10) throw new DiscoveryError('input', 'Invalid search session or page.', 400);
  const id = v.session, page = Number(v.page), now = Date.now(), iso = new Date(now).toISOString(), day = iso.slice(0,10), month = iso.slice(0,7);
  if (page > cap.search || cap.search === 0) throw new DiscoveryError('search_limit', 'The configured per-search page limit has been reached.', 429);
  if (page === 1) {
    const spec = discoverySpec(v.spec), query = googleQuery(spec.input, spec.input.platforms, spec.region);
    if (query.length > 4096) throw new DiscoveryError('input', 'The combined query is too long. Reduce alternatives or selected platforms.', 400);
    await db.prepare('INSERT OR IGNORE INTO discovery_sessions(id,spec,query,expires) VALUES(?,?,?,?)').bind(id,JSON.stringify(spec),query,now+3600000).run();
  }
  const session = await db.prepare('SELECT * FROM discovery_sessions WHERE id=? AND expires>?').bind(id,now).first<{spec:string; query:string; next_page:number; seen:string; ended:number}>();
  if (!session) throw new DiscoveryError('session_expired', 'This search expired. Click Search to start again.', 410);
  if (page === 1 && JSON.stringify(discoverySpec(v.spec)) !== session.spec) throw new DiscoveryError('input', 'This search ID already belongs to different inputs.', 409);
  const previous = await db.prepare('SELECT response,status FROM discovery_requests WHERE session=? AND page=?').bind(id,page).first<{response:string|null; status:number|null}>();
  if (previous) {
    if (previous.response && previous.status === 200) {
      const saved: DiscoveryPage = JSON.parse(previous.response);
      if(JSON.parse(session.spec).region==='Global' && (saved.globalPolicy!=='strict-global-v1'||
         saved.globalReview?.some(row=>!row.globalCheck||Date.now()-Date.parse(row.globalCheck.checkedAt)>600000))){
        const globalReview=await verifyGlobalPage(saved.globalReview??saved.results,db,fetcher);
        saved.results=globalReview.filter(row=>row.globalCheck?.status==='verified');saved.globalReview=globalReview;saved.globalPolicy='strict-global-v1';
      }
      return {...saved,usage:{...saved.usage,request:0,cached:true,providerCredits:0}};
    }
    throw new DiscoveryError('already_requested', previous.status ? 'This page previously failed. Start a new Search; no duplicate provider request was made.' : 'This page is already being requested. No duplicate request was made.', 409);
  }
  if (session.ended || page !== session.next_page) throw new DiscoveryError('page_order', 'Load only the next page of the submitted search.', 409);
  const spec: DiscoveryInput = JSON.parse(session.spec);
  const cacheKey = [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(session.query+'\n'+page)))].map(v=>v.toString(16).padStart(2,'0')).join('');
  const cache = await db.prepare('SELECT body FROM discovery_cache WHERE key=? AND expires>?').bind(cacheKey,now).first<{body:string}>();
  const charged = cache ? 0 : 1;
  // One serialized D1 write checks and reserves all caps before any provider IO.
  // Failed/time-out requests retain their reservation; no refunds or retry loops.
  const reservation = await db.prepare(`INSERT OR IGNORE INTO discovery_requests(session,page,time,day,month,charged)
    SELECT ?,?,?,?,?,? WHERE
    (SELECT COUNT(*) FROM discovery_requests WHERE session=?) < ? AND
    (?=0 OR ((SELECT COALESCE(SUM(charged),0) FROM discovery_requests WHERE day=?) < ? AND
    (SELECT COALESCE(SUM(charged),0) FROM discovery_requests WHERE month=?) < ? AND
    (SELECT COALESCE(SUM(charged),0) FROM discovery_requests) < ?))`).bind(id,page,now,day,month,charged,id,cap.search,charged,day,cap.daily,month,cap.monthly,cap.total).run();
  if (!reservation.meta.changes) {
    const duplicate = await db.prepare('SELECT page FROM discovery_requests WHERE session=? AND page=?').bind(id,page).first();
    if (duplicate) throw new DiscoveryError('already_requested','This page is already being requested. No duplicate provider request was made.',409);
    throw new DiscoveryError('quota_exhausted',`A shared usage cap was reached (daily ${cap.daily}, monthly ${cap.monthly}, total ${cap.total}, per search ${cap.search}). No provider request was made. UTC periods apply.`,429);
  }
  try {
    const data: ProviderPage = cache ? JSON.parse(cache.body) : await fetchSerper(session.query,page,env.SERPER_API_KEY,fetcher);
    const rows = candidatePage(data,spec,JSON.parse(session.seen));
    const globalReview=spec.region==='Global'?await verifyGlobalPage(rows.results,db,fetcher):undefined;
    const usage = await db.prepare(`SELECT COALESCE(SUM(charged),0) total,
      COALESCE(SUM(CASE WHEN day=? THEN charged ELSE 0 END),0) daily,
      COALESCE(SUM(CASE WHEN month=? THEN charged ELSE 0 END),0) monthly,
      COALESCE(SUM(CASE WHEN session=? THEN charged ELSE 0 END),0) search FROM discovery_requests`).bind(day,month,id).first<{total:number;daily:number;monthly:number;search:number}>();
    if (!usage) throw new Error('Usage missing');
    const limited = page >= cap.search;
    const result: DiscoveryPage = {query:session.query,session:id,page,results:globalReview?globalReview.filter(row=>row.globalCheck?.status==='verified'):rows.results,globalReview,globalPolicy:globalReview?'strict-global-v1':undefined,rawCount:rows.rawCount,rejected:rows.rejected,duplicates:rows.duplicates,
      hasMore:!rows.exhausted&&!limited,
      stopReason: rows.exhausted ? rows.rawCount ? 'The provider repeated the previously loaded raw results. Pagination stopped.' : 'The provider returned an empty organic page. Pagination stopped.' : limited ? 'The configured per-search page limit was reached. More indexed results may exist.' : undefined,
      warning: rows.rejected ? `${rows.rejected} results were omitted because the URL was not a supported posting or the title did not match. Selected-platform coverage is not guaranteed.` : undefined,
      usage:{...usage,request:charged,cached:!!cache,providerCredits:cache?0:data.credits,dailyLimit:cap.daily,monthlyLimit:cap.monthly,totalLimit:cap.total,searchLimit:cap.search}};
    await db.batch([
      db.prepare('UPDATE discovery_sessions SET seen=?,next_page=?,ended=? WHERE id=?').bind(JSON.stringify(rows.seen),page+1,result.hasMore?0:1,id),
      db.prepare('UPDATE discovery_requests SET response=?,status=200 WHERE session=? AND page=?').bind(JSON.stringify(result),id,page),
      db.prepare('INSERT OR REPLACE INTO discovery_cache(key,body,expires) VALUES(?,?,?)').bind(cacheKey,JSON.stringify(data),now+600000),
      db.prepare('DELETE FROM discovery_cache WHERE expires<?').bind(now),
      db.prepare('DELETE FROM discovery_sessions WHERE expires<?').bind(now),
      db.prepare('UPDATE discovery_requests SET response=NULL WHERE time<? AND response IS NOT NULL').bind(now-3600000),
    ]);
    return result;
  } catch (e) {
    await db.prepare('UPDATE discovery_requests SET status=? WHERE session=? AND page=?').bind(e instanceof DiscoveryError?e.status:503,id,page).run();
    throw e;
  }
}
