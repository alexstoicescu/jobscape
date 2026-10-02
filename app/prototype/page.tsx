'use client';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {Search, MapPin, SlidersHorizontal, ExternalLink, LoaderCircle, BriefcaseBusiness} from 'lucide-react';
import {Checkbox} from '@/components/ui/checkbox';
import {platforms, googleQuery, validateInput, type SearchInput} from '@/lib/search';
import {extensionRequest, resultCards, paginationState, type Pagination, type GoogleCard} from '@/lib/extension-search';
import {hiringRegions, type HiringRegion} from '@/lib/hiring-region-map';
import {hiringEvidence, matchesHiringRegion} from '@/lib/hiring-regions';
const initial: SearchInput = {keywords: '', location: '', remote: false, platforms: platforms.map(p => p.id), expandTitles: true};
export default function Prototype() {
  const [form, setForm] = useState(initial);
  const [connection, setConnection] = useState('Checking Chrome extension…');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [cards, setCards] = useState<GoogleCard[]>([]);
  const [submitted, setSubmitted] = useState<SearchInput | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [paging, setPaging] = useState(false);
  const [warning, setWarning] = useState('');
  const [region, setRegion] = useState<HiringRegion>('Global');
  const [includeUnknown, setIncludeUnknown] = useState(false);
  const classified = cards.map(card => ({card, hiring: hiringEvidence(card)}));
  const visible = classified.filter(({hiring}) => matchesHiringRegion(hiring, region, includeUnknown));
  const unknownCount = classified.filter(({hiring}) => hiring.unknown).length;
  const request = useRef(0);
  const inFlight = useRef(false);
  const appendScroll = useRef<{x: number; y: number} | null>(null);
  useLayoutEffect(() => {
    if (appendScroll.current) {
      window.scrollTo(appendScroll.current.x, appendScroll.current.y);
      appendScroll.current = null;
    }
  }, [cards]);
  const check = async () => {
    try {
      const reply = await extensionRequest('ping');
      if (reply.type !== 'ready') throw new Error('Unexpected connection response.');
      setConnection('Chrome extension connected.'); return true;
    } catch (e) { setConnection(e instanceof Error ? e.message : 'Extension disconnected.'); return false; }
  };
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.has('q')) setForm({...initial, keywords: q.get('q') ?? '', location: q.get('l') ?? '', remote: q.get('r') === '1',
      platforms: q.has('p') ? (q.get('p') ?? '').split(',').filter(id => platforms.some(p => p.id === id)) : initial.platforms,
      expandTitles: q.get('a') !== '0'});
    // Connection handshake only. Restoring filters never performs a search.
    void check();
    const disconnected = (event: MessageEvent) => {
      if (event.source === window && event.origin === location.origin && event.data?.protocol === 'jobscape-extension-v1' &&
          event.data?.direction === 'response' && event.data?.type === 'disconnected') {
        setConnection('Extension disconnected. Click Search to reconnect.');
      }
    };
    window.addEventListener('message', disconnected);
    return () => { ++request.current; window.removeEventListener('message', disconnected); };
  }, []);
  const search = async () => {
    if (inFlight.current) return;
    let input: SearchInput;
    try { input = validateInput(form); } catch (e) { setError(e instanceof Error ? e.message : 'Check your search.'); return; }
    const id = ++request.current;
    inFlight.current = true;
    const combined = googleQuery(input);
    appendScroll.current = null;
    setQuery(combined); setSubmitted(input); setPagination(null); setCards([]); setError(''); setWarning(''); setBusy(true); setPaging(false);
    history.replaceState(null, '', '?' + new URLSearchParams({q: input.keywords, l: input.location, r: input.remote ? '1' : '0', p: input.platforms.join(','), a: input.expandTitles === false ? '0' : '1'}));
    try {
      if (!await check()) throw new Error('Extension missing or disconnected. Enable it in Chrome, then click Search to reconnect.');
      const response = await extensionRequest('search', {query: combined, platforms: input.platforms});
      const rows = resultCards(response, combined, input.platforms);
      const page = paginationState(response);
      if (id === request.current) {
        setCards(rows); setPagination(page); setWarning(typeof response.warning === 'string' ? response.warning : '');
      }
    } catch (e) { if (id === request.current) setError(e instanceof Error ? e.message : 'Search failed.'); }
    finally { inFlight.current = false; if (id === request.current) setBusy(false); }
  };
  const loadMore = async () => {
    if (inFlight.current || !pagination?.hasMore || !submitted) return;
    inFlight.current = true;
    const id = ++request.current;
    setBusy(true); setPaging(true); setError(''); setWarning('');
    try {
      if (!await check()) throw new Error('Extension missing or disconnected. Enable it in Chrome, then click Load more to reconnect.');
      const response = await extensionRequest('load-more', {token: pagination.token});
      // Use the submitted query/platforms, even if the form has since changed.
      const rows = resultCards(response, query, submitted.platforms);
      const page = paginationState(response);
      if (id === request.current) {
        appendScroll.current = {x: window.scrollX, y: window.scrollY};
        setCards(previous => {
          const seen = new Set(previous.map(row => row.url));
          return [...previous, ...rows.filter(row => { if (seen.has(row.url)) return false; seen.add(row.url); return true; })];
        });
        setPagination(page); setWarning(typeof response.warning === 'string' ? response.warning : '');
      }
    } catch (e) { if (id === request.current) setError(e instanceof Error ? e.message : 'Could not load the next page.'); }
    finally { inFlight.current = false; if (id === request.current) { setBusy(false); setPaging(false); } }
  };
  const openHelper = async () => { try { await extensionRequest('open-helper'); } catch (e) { setError(e instanceof Error ? e.message : 'Could not open helper.'); } };
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="/"><span className="brand-icon"><Search size={21}/></span>Job<span className="brand-light">Scape</span><span className="beta">PROTOTYPE</span></a><div className="top-note">Google ATS search <span className="free-tag">Free to use</span></div></header>
    <main className="workspace">
      <section className="intro"><div className="eyebrow">THE JOB SEARCH, WITHOUT THE QUERY WRANGLING</div><h1>Find your next role.<br/><span>Go straight to the source.</span></h1><p>One combined search across your selected hiring platforms, with results here in JobScape.</p></section>
      <div className="source-notice" role="status"><p>{connection}</p><button type="button" disabled={busy} onClick={() => void check()}>Check connection</button></div>
      <form className="search-panel" onSubmit={e => {e.preventDefault(); void search();}}>
        <div className="search-fields"><label className="field"><span>Job title or keywords</span><div><Search size={20}/><input required maxLength={180} value={form.keywords} onChange={e => setForm({...form, keywords: e.target.value})} placeholder="e.g. developer relations, community" aria-describedby="prototype-keyword-help"/></div></label>
          <label className="field location"><span>Location</span><div><MapPin size={20}/><input maxLength={100} value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="City, country, or leave blank"/></div></label>
          <button className="search-button" type="submit" disabled={busy || !form.platforms.length}>{busy ? <LoaderCircle className="spin" size={19}/> : <Search size={19}/>} {busy ? 'Searching' : 'Search'}</button></div>
        <div className="search-bottom"><span id="prototype-keyword-help">Separate alternatives with a comma or OR.</span><label className="check-label"><Checkbox checked={form.remote} onCheckedChange={v => setForm({...form, remote: v === true})}/>Prefer remote</label></div>
        <div className="search-options"><label className="check-label"><Checkbox checked={form.expandTitles !== false} onCheckedChange={v => setForm({...form, expandTitles: v === true})}/>Include title aliases</label><p>Location and remote preferences are Google query terms. They do not verify hiring eligibility.</p></div>
        <p className="search-destination">{form.platforms.length} selected ATS platforms in one query. No employer list or posting-age cutoff.</p>
      </form>
      <div className="main-grid"><aside className="filters"><div className="filters-title"><SlidersHorizontal size={17}/><h2>ATS platforms</h2></div><p className="source-note">Searches publicly indexed pages across these domains. Google may omit postings or retain closed roles.</p>
        <div className="select-actions"><button onClick={() => setForm({...form, platforms: initial.platforms})}>Select all</button><span>·</span><button onClick={() => setForm({...form, platforms: []})}>Clear</button></div>
        <div className="provider-list">{platforms.map(p => <label className="provider" key={p.id}><Checkbox checked={form.platforms.includes(p.id)} onCheckedChange={() => setForm({...form, platforms: form.platforms.includes(p.id) ? form.platforms.filter(id => id !== p.id) : [...form.platforms, p.id]})}/><span>{p.name}<small>{p.domains[0]}</small></span></label>)}</div></aside>
        <section className="results-area" aria-live="polite">
          <div className="search-bottom"><label className="check-label">Hiring region <select aria-label="Hiring region" value={region} onChange={e => setRegion(e.target.value as HiringRegion)}>{hiringRegions.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
            {region !== 'Global' && <label className="check-label"><Checkbox checked={includeUnknown} onCheckedChange={v => setIncludeUnknown(v === true)}/>Include unknown</label>}</div>
          <p className="small-note">Filters loaded titles and snippets only. Employer HQ does not determine hiring region. Country restrictions still apply; eligibility is not verified.</p>
          {query && <details className="query-details"><summary>See the combined query</summary><code>{query}</code></details>}
          {busy && !paging && <div className="loading" role="status"><p><LoaderCircle size={18} className="spin"/>Retrieving one Google results page…</p></div>}
          {error && <div className="message error" role="alert"><h2>Search could not finish.</h2><p>{error}</p><button onClick={() => void openHelper()}>Open helper tab</button><p>No automatic retry or company-feed fallback was made.</p></div>}
          {!query && <div className="welcome"><div className="welcome-icon"><BriefcaseBusiness size={28}/></div><h2>A shorter path to the right job.</h2><p>Load the Chrome extension, choose your platforms, then click Search.</p></div>}
          {cards.length > 0 && <><div className="result-summary"><div><h2>{visible.length} of {cards.length} loaded results</h2><p>{pagination?.pages ?? 1} results {pagination?.pages === 1 ? 'page' : 'pages'} retrieved, capped at 20 cards per page. Coverage of individual platforms is not guaranteed.</p><p>{unknownCount} with unknown hiring region{region !== 'Global' && !includeUnknown ? ' hidden' : ''}. Switching region preserves all loaded cards.</p></div></div>
            <div className="job-list">{visible.map(({card, hiring}) => <article className="job-card" key={card.url}><div className={'company-avatar ' + card.platform}><Search size={20}/></div><div className="job-main"><div className="job-company">{platforms.find(p => p.id === card.platform)?.name}</div><h3><a href={card.url} target="_blank" rel="noopener noreferrer">{card.title}</a></h3>{card.snippet ? <p className="job-description">{card.snippet}</p> : <p className="small-note">Google did not expose a readable snippet.</p>}
              <p className="match-reason">Hiring region: {hiring.unknown ? 'Unknown' : hiring.worldwide ? 'Global' : hiring.regions.join(', ') || 'Outside selected regions'}</p>
              {hiring.evidence.map(phrase => <p className="small-note" key={phrase}>Evidence: “{phrase}”</p>)}
              {hiring.countries.length > 0 && <p className="eligibility uncertain">{hiring.restricted ? 'Country restriction' : 'Listed job countries'}: {hiring.countries.join(', ')}. This does not establish eligibility elsewhere in the region.</p>}
              {hiring.excludedCountries.length > 0 && <p className="eligibility uncertain">Excluded countries: {hiring.excludedCountries.join(', ')}.</p>}
              <p className="small-note">{new URL(card.url).hostname}</p></div><a className="open-job" href={card.url} target="_blank" rel="noopener noreferrer" aria-label={'Open original: ' + card.title}><ExternalLink size={17}/></a></article>)}</div>
              {!visible.length && <p className="small-note">No loaded results match this region. Choose Global or Include unknown, or explicitly load another page if available.</p>}</>}
          {pagination?.hasMore && <button className="load-more" disabled={busy} onClick={() => void loadMore()}>{paging ? 'Loading…' : 'Load more'}</button>}
          {pagination && !pagination.hasMore && <p className="small-note">No next-page link was exposed by Google.</p>}
          {pagination && cards.length === 0 && <p className="small-note">No selected-ATS destinations on this page.</p>}
          {warning && <p className="small-note" role="status">{warning}</p>}
          <p className="small-note">Google titles and snippets are search evidence, not verified job descriptions or active status. Description reading is deferred.</p>
        </section></div>
      <footer><span>JobScape <span className="footer-separator">/</span> a direct route to company jobs</span><span>No account. No search API key.</span></footer>
    </main>
  </div>;
}
