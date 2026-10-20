'use client';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {Search, MapPin, SlidersHorizontal, ExternalLink, LoaderCircle, BriefcaseBusiness} from 'lucide-react';
import {Checkbox} from '@/components/ui/checkbox';
import {ThemeToggle} from '@/components/theme-toggle';
import {platforms, validateInput, type SearchInput} from '@/lib/search';
import {appendCandidates, globalCounts, type Candidate, type DiscoveryPage, type DiscoveryInput} from '@/lib/discovery';
const initial: SearchInput = {keywords:'',location:'',remote:false,platforms:platforms.map(p=>p.id),expandTitles:true};
const regions = ['All','Global','EU','EMEA','APAC','US'] as const;
export default function DiscoverySearch({enabled}: {enabled: boolean}) {
  const [form,setForm] = useState(initial);
  const [region,setRegion] = useState<DiscoveryInput['region']>('All');
  const [homeHref,setHomeHref] = useState('/');
  const [busy,setBusy] = useState(false);
  const [paging,setPaging] = useState(false);
  const [error,setError] = useState('');
  const [cards,setCards] = useState<Candidate[]>([]);
  const [review,setReview] = useState<Candidate[]>([]);
  const [page,setPage] = useState<DiscoveryPage|null>(null);
  const [submitted,setSubmitted] = useState<DiscoveryInput|null>(null);
  const [started,setStarted] = useState(false);
  const globalMode=submitted?.region==='Global',counts=globalCounts(review);
  const visible=globalMode?cards.filter(card=>card.globalCheck?.status==='verified'):cards;
  const inFlight = useRef(false), revision = useRef(0);
  const controller = useRef<AbortController|null>(null);
  const scroll = useRef<{x:number;y:number}|null>(null);
  useLayoutEffect(()=>{if(scroll.current){window.scrollTo(scroll.current.x,scroll.current.y);scroll.current=null;}},[cards]);
  useEffect(()=>{
    const q = new URLSearchParams(location.search);
    setHomeHref('/'+location.search);
    const hr = q.get('hr') === 'Global remote' ? 'Global' : q.get('hr');
    if (regions.includes(hr as DiscoveryInput['region'])) setRegion(hr as DiscoveryInput['region']);
    if(q.has('q')) setForm({...initial,keywords:q.get('q')??'',location:q.get('l')??'',remote:q.get('r')==='1',
      platforms:q.has('p')?(q.get('p')??'').split(',').filter(id=>platforms.some(p=>p.id===id)):initial.platforms,
      expandTitles:q.get('a')!=='0',wholePageKeywords:q.get('wp')==='1'});
    // Restoring the URL never starts a paid/provider request.
    return ()=>{++revision.current;controller.current?.abort();};
  },[]);
  const retrieve = async (body: unknown, append: boolean, spec: DiscoveryInput) => {
    if(inFlight.current) return;
    inFlight.current=true;
    const id=++revision.current;
    controller.current?.abort();
    const abort=new AbortController();controller.current=abort;
    const focus=append?document.activeElement:null;
    setBusy(true);setPaging(append);setError('');
    try {
      const response=await fetch('/api/discovery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:abort.signal});
      const data=await response.json() as DiscoveryPage & {code?:string;error?:string};
      if(!response.ok) throw new Error(`${typeof data.code==='string'?data.code+': ':''}${typeof data.error==='string'?data.error:'Search request failed.'}`);
      if(id!==revision.current) return;
      if(append) scroll.current={x:window.scrollX,y:window.scrollY};
      else scroll.current=null;
      const accepted=spec.region==='Global'?data.results.filter(row=>row.globalCheck?.status==='verified'):data.results;
      const assessed=data.globalReview??data.results;
      setCards(previous=>append?appendCandidates(previous,accepted):accepted);
      setReview(previous=>append?appendCandidates(previous,assessed):assessed);
      setPage(data);setSubmitted(spec);
    } catch(e) {if(id===revision.current&&!abort.signal.aborted)setError(e instanceof Error?e.message:'Search failed.');}
    finally {inFlight.current=false;if(id===revision.current){setBusy(false);setPaging(false);if(focus instanceof HTMLElement)requestAnimationFrame(()=>focus.isConnected&&focus.focus({preventScroll:true}));}}
  };
  const search = async () => {
    if(inFlight.current || !enabled) return;
    let input: SearchInput;
    try {input=validateInput(form);}catch(e){setError(e instanceof Error?e.message:'Check the search inputs.');return;}
    const spec={input,region};
    setStarted(true);setCards([]);setReview([]);setPage(null);setSubmitted(spec);
    history.replaceState(null,'','?'+new URLSearchParams({q:input.keywords,l:input.location,r:input.remote?'1':'0',p:input.platforms.join(','),a:input.expandTitles===false?'0':'1',hr:region,wp:input.wholePageKeywords?'1':'0'}));
    setHomeHref('/'+location.search);
    await retrieve({session:crypto.randomUUID(),page:1,spec},false,spec);
  };
  const loadMore = async () => {
    if(!page?.hasMore || !submitted || inFlight.current) return;
    // Form edits cannot alter the submitted server session or pagination query.
    await retrieve({session:page.session,page:page.page+1},true,submitted);
  };
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href={homeHref}><span className="brand-icon"><Search size={21}/></span>Job<span className="brand-light">Scape</span><span className="beta">BETA</span></a><div className="header-actions"><div className="top-note">Google ATS search <span className="free-tag">Free to use</span></div><ThemeToggle/></div></header>
    <main className="workspace">
      <section className="intro"><div className="eyebrow">THE JOB SEARCH, WITHOUT THE QUERY WRANGLING</div><h1>Find your next role.<br/><span>Go straight to the source.</span></h1><p>One combined search across your selected hiring platforms, with results here in JobScape.</p></section>
      <div className="source-notice" role="status"><p>{enabled?'Serper discovery preview. No Chrome extension required.':'Serper discovery is disabled on this server. Ask the site owner to enable the preview.'} Indexed candidates may be closed or ineligible.</p></div>
      <form className="search-panel" onSubmit={e=>{e.preventDefault();void search();}}>
        <div className="search-fields"><label className="field"><span>Job title or keywords</span><div><Search size={20}/><input required maxLength={180} value={form.keywords} onChange={e=>setForm({...form,keywords:e.target.value})} placeholder="e.g. developer relations, community" aria-describedby="discovery-keyword-help"/></div></label>
          <label className="field location"><span>Location</span><div><MapPin size={20}/><input maxLength={100} value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="City, country, or leave blank"/></div></label>
          <button className="search-button" type="submit" disabled={!enabled||busy||!form.platforms.length}>{busy?<LoaderCircle className="spin" size={19}/>:<Search size={19}/>} {busy?'Searching':'Search'}</button></div>
        <div className="search-bottom"><span id="discovery-keyword-help">Separate alternatives with a comma or OR. Quotes preserve phrases.</span><label className="check-label"><Checkbox checked={form.remote} onCheckedChange={v=>setForm({...form,remote:v===true})}/>Prefer remote</label></div>
        <div className="search-options"><label className="check-label"><Checkbox checked={form.expandTitles!==false} onCheckedChange={v=>setForm({...form,expandTitles:v===true})}/>Include title aliases</label><label className="check-label"><Checkbox checked={form.wholePageKeywords===true} onCheckedChange={v=>setForm({...form,wholePageKeywords:v===true})}/>Search whole-page keywords</label><p>Default searches require keywords in returned titles; snippet mentions do not qualify. Location and remote preferences are discovery hints, not eligibility evidence.</p></div>
        <p className="search-destination">{form.platforms.length} selected ATS platforms in one query. No employer list or posting-age cutoff.</p>
      </form>
      <div className="main-grid"><aside className="filters"><div className="filters-title"><SlidersHorizontal size={17}/><h2>ATS platforms</h2></div><p className="source-note">Searches publicly indexed pages across these domains. Google may omit postings or retain closed roles.</p>
        <div className="select-actions"><button onClick={()=>setForm({...form,platforms:initial.platforms})}>Select all</button><span>·</span><button onClick={()=>setForm({...form,platforms:[]})}>Clear</button></div>
        <div className="provider-list">{platforms.map(p=><label className="provider" key={p.id}><Checkbox checked={form.platforms.includes(p.id)} onCheckedChange={()=>setForm({...form,platforms:form.platforms.includes(p.id)?form.platforms.filter(id=>id!==p.id):[...form.platforms,p.id]})}/><span>{p.name}<small>{p.domains[0]}</small></span></label>)}</div></aside>
        <section className="results-area" aria-live="polite">
          <div className="search-bottom"><label className="check-label">Search hiring region <select aria-label="Search hiring region" value={region} onChange={e=>setRegion(e.target.value as DiscoveryInput['region'])}>{regions.map(name=><option key={name} value={name}>{name}</option>)}</select></label></div>
          <p className="small-note">Region changes apply on the next Search. Global displays only fully remote positions with explicit worldwide hiring evidence from the original posting. Other regions remain discovery hints.</p>
          {page&&<details className="query-details"><summary>See the combined query</summary><code>{page.query}</code></details>}
          {busy&&!paging&&<div className="loading" role="status"><p><LoaderCircle size={18} className="spin"/>{globalMode?'Retrieving one Google results page and verifying its original postings…':'Retrieving one Google results page…'}</p></div>}
          {error&&<div className="message error" role="alert"><h2>Search could not finish.</h2><p>{error}</p><p>No automatic retry or company-feed fallback was made. A failed reserved page requires a new Search.</p></div>}
          {!started&&<div className="welcome"><div className="welcome-icon"><BriefcaseBusiness size={28}/></div><h2>A shorter path to the right job.</h2><p>Choose your platforms, then click Search.</p></div>}
          {page&&<><div className="result-summary"><div><h2>{visible.length} {globalMode?'verified Global Remote positions':'loaded search candidates'}</h2><p>Submitted hiring region: {submitted?.region}. {page.page} results {page.page===1?'page':'pages'} retrieved. Coverage of individual platforms is not guaranteed.</p>{globalMode&&<p>Verified Global: {counts.verified}. Restricted or not fully remote: {counts.restricted}. Unverified: {counts.unverified}. Counts cover unique candidates on the loaded pages only.</p>}</div></div>
            <div className="job-list">{visible.map(card=><article className="job-card" key={card.key}><div className={'company-avatar '+card.platform}><Search size={20}/></div><div className="job-main"><div className="job-company">{platforms.find(p=>p.id===card.platform)?.name}</div><h3><a href={card.url} target="_blank" rel="noopener noreferrer">{card.title}</a></h3>{card.snippet?<p className="job-description">{card.snippet}</p>:<p className="small-note">Google did not expose a readable snippet.</p>}
              <p className="match-reason">{globalMode?'Verified Global Remote — stated posting terms':'Unchecked discovery candidate'}</p>
              {globalMode&&card.globalCheck&&<div><p className="small-note">{card.globalCheck.reason}</p>{card.globalCheck.evidence.map((item,i)=><p className="small-note" key={i}>{item.source}: “{item.quote}”</p>)}{card.globalCheck.restrictions.map((item,i)=><p className="small-note" key={i}>Restriction: {item}</p>)}<p className="small-note">Checked {new Date(card.globalCheck.checkedAt).toLocaleString()}{card.globalCheck.cached?' (cached)':''}. Individual work authorization and current vacancy status are not verified.</p></div>}
              <p className="small-note">{globalMode?'Active status and required languages remain Unknown.':'Active status, remote eligibility, worldwide hiring and required languages: Unknown.'}</p><p className="small-note">{new URL(card.url).hostname}</p></div><a className="open-job" href={card.url} target="_blank" rel="noopener noreferrer" aria-label={'Open original: '+card.title}><ExternalLink size={17}/></a></article>)}</div>
            {globalMode&&(['restricted','unknown'] as const).map(status=><details className="query-details" key={status}><summary>{status==='restricted'?'Restricted or not fully remote':'Unverified'} ({review.filter(row=>(row.globalCheck?.status??'unknown')===status).length})</summary><ul>{review.filter(row=>(row.globalCheck?.status??'unknown')===status).map(row=><li key={row.key}><a href={row.url} target="_blank" rel="noopener noreferrer">{row.title}</a><p className="small-note">{row.globalCheck?.reason??'No original-posting verification was returned.'}</p></li>)}</ul></details>)}
            {visible.length===0&&!error&&<p className="small-note">{globalMode?'No verified Global Remote positions on the loaded pages. This does not show that no Global jobs exist.':'No accepted posting candidates on the loaded pages.'} {page.hasMore?'Load more remains available while the provider returns new raw results.':'See the pagination status below.'}</p>}
            <p className="small-note">Usage reservations: {page.usage.request} new API request for this page{page.usage.cached?' (cached)':''}; {page.usage.search}/{page.usage.searchLimit} this search, {page.usage.daily}/{page.usage.dailyLimit} today, {page.usage.monthly}/{page.usage.monthlyLimit} this month, {page.usage.total}/{page.usage.totalLimit} total. Failed requests also count. UTC periods.</p>
            {page.hasMore&&<button className="load-more" disabled={busy} onClick={()=>void loadMore()}>{paging?'Loading…':'Load more'}</button>}
            {page.stopReason&&<p className="small-note">{page.stopReason}</p>}{page.warning&&<p className="small-note" role="status">{page.warning}</p>}</>}
          <p className="small-note">Google titles and snippets are discovery evidence. Global checks only the current page’s original postings; inaccessible or ambiguous sources remain Unverified. Required languages and individual work authorization are not checked.</p>
        </section></div>
      <footer><span>JobScape <span className="footer-separator">/</span> a direct route to company jobs</span><span>No account. No browser extension.</span></footer>
    </main>
  </div>;
}
