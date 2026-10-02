'use client';
import {useEffect, useRef, useState} from 'react';
import {Search, MapPin, SlidersHorizontal, ExternalLink, LoaderCircle, BriefcaseBusiness} from 'lucide-react';
import {Checkbox} from '@/components/ui/checkbox';
import {platforms, googleQuery, validateInput, type SearchInput} from '@/lib/search';
import {extensionRequest, resultCards, type GoogleCard} from '@/lib/extension-search';
const initial: SearchInput = {keywords: '', location: '', remote: false, platforms: platforms.map(p => p.id), expandTitles: true};
export default function Prototype() {
  const [form, setForm] = useState(initial);
  const [connected, setConnected] = useState(false);
  const [connection, setConnection] = useState('Checking Chrome extension…');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [cards, setCards] = useState<GoogleCard[]>([]);
  const request = useRef(0);
  const check = async () => {
    try {
      const reply = await extensionRequest('ping');
      if (reply.type !== 'ready') throw new Error('Unexpected connection response.');
      setConnected(true); setConnection('Chrome extension connected.');
    } catch (e) { setConnected(false); setConnection(e instanceof Error ? e.message : 'Extension disconnected.'); }
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
        setConnected(false); setConnection('Extension disconnected. Reload after enabling it, then check the connection.');
        ++request.current; setBusy(false);
      }
    };
    window.addEventListener('message', disconnected);
    return () => { ++request.current; window.removeEventListener('message', disconnected); };
  }, []);
  const search = async () => {
    let input: SearchInput;
    try { input = validateInput(form); } catch (e) { setError(e instanceof Error ? e.message : 'Check your search.'); return; }
    const id = ++request.current;
    const combined = googleQuery(input);
    setQuery(combined); setCards([]); setError(''); setBusy(true);
    history.replaceState(null, '', '?' + new URLSearchParams({q: input.keywords, l: input.location, r: input.remote ? '1' : '0', p: input.platforms.join(','), a: input.expandTitles === false ? '0' : '1'}));
    try {
      const response = await extensionRequest('search', {query: combined, platforms: input.platforms});
      if (id === request.current) setCards(resultCards(response, combined, input.platforms));
    } catch (e) { if (id === request.current) setError(e instanceof Error ? e.message : 'Search failed.'); }
    finally { if (id === request.current) setBusy(false); }
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
          <button className="search-button" type="submit" disabled={!connected || busy || !form.platforms.length}>{busy ? <LoaderCircle className="spin" size={19}/> : <Search size={19}/>} {busy ? 'Searching' : 'Search'}</button></div>
        <div className="search-bottom"><span id="prototype-keyword-help">Separate alternatives with a comma or OR.</span><label className="check-label"><Checkbox checked={form.remote} onCheckedChange={v => setForm({...form, remote: v === true})}/>Prefer remote</label></div>
        <div className="search-options"><label className="check-label"><Checkbox checked={form.expandTitles !== false} onCheckedChange={v => setForm({...form, expandTitles: v === true})}/>Include title aliases</label><p>Location and remote preferences are Google query terms. They do not verify hiring eligibility.</p></div>
        <p className="search-destination">{form.platforms.length} selected ATS platforms in one query. No employer list or posting-age cutoff.</p>
      </form>
      <div className="main-grid"><aside className="filters"><div className="filters-title"><SlidersHorizontal size={17}/><h2>ATS platforms</h2></div><p className="source-note">Searches publicly indexed pages across these domains. Google may omit postings or retain closed roles.</p>
        <div className="select-actions"><button onClick={() => setForm({...form, platforms: initial.platforms})}>Select all</button><span>·</span><button onClick={() => setForm({...form, platforms: []})}>Clear</button></div>
        <div className="provider-list">{platforms.map(p => <label className="provider" key={p.id}><Checkbox checked={form.platforms.includes(p.id)} onCheckedChange={() => setForm({...form, platforms: form.platforms.includes(p.id) ? form.platforms.filter(id => id !== p.id) : [...form.platforms, p.id]})}/><span>{p.name}<small>{p.domains[0]}</small></span></label>)}</div></aside>
        <section className="results-area" aria-live="polite">
          {query && <details className="query-details"><summary>See the combined query</summary><code>{query}</code></details>}
          {busy && <div className="loading" role="status"><p><LoaderCircle size={18} className="spin"/>Retrieving one Google results page…</p></div>}
          {error && <div className="message error" role="alert"><h2>Search could not finish.</h2><p>{error}</p><button onClick={() => void openHelper()}>Open helper tab</button><p>No automatic retry or company-feed fallback was made.</p></div>}
          {!query && <div className="welcome"><div className="welcome-icon"><BriefcaseBusiness size={28}/></div><h2>A shorter path to the right job.</h2><p>Load the Chrome extension, choose your platforms, then click Search.</p></div>}
          {cards.length > 0 && <><div className="result-summary"><div><h2>{cards.length} Google results</h2><p>First results page, capped at 20 cards. Coverage of individual platforms is not guaranteed.</p></div></div>
            <div className="job-list">{cards.map(card => <article className="job-card" key={card.url}><div className={'company-avatar ' + card.platform}><Search size={20}/></div><div className="job-main"><div className="job-company">{platforms.find(p => p.id === card.platform)?.name}</div><h3><a href={card.url} target="_blank" rel="noopener noreferrer">{card.title}</a></h3>{card.snippet ? <p className="job-description">{card.snippet}</p> : <p className="small-note">Google did not expose a readable snippet.</p>}<p className="small-note">{new URL(card.url).hostname}</p></div><a className="open-job" href={card.url} target="_blank" rel="noopener noreferrer" aria-label={'Open original: ' + card.title}><ExternalLink size={17}/></a></article>)}</div></>}
          <p className="small-note">Google titles and snippets are search evidence, not verified job descriptions or active status. Description reading and pagination are deferred in this milestone.</p>
        </section></div>
      <footer><span>JobScape <span className="footer-separator">/</span> a direct route to company jobs</span><span>No account. No search API key.</span></footer>
    </main>
  </div>;
}
