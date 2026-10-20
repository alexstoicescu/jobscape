// Self-contained DOM reader injected only into our Google helper.
export async function extractGoogle(expected = {}) {
  const current = new URL(location.href);
  const failure = (code, error) => ({code, error, results: [], pageUrl: location.href});
  if (expected.query && (current.searchParams.get('q') !== expected.query || Number(current.searchParams.get('start') ?? 0) !== expected.offset))
    return failure('navigation_mismatch', 'Google is not displaying the submitted query and page. Open the helper to inspect it.');
  const read = () => {
    const text = document.body?.innerText ?? '';
    if (location.pathname.startsWith('/sorry') || document.querySelector('iframe[src*="recaptcha"], #captcha-form') || /unusual traffic/i.test(text.slice(0,10000)))
      return {...failure('verification', 'Google requires manual verification. Open the helper tab; no bypass or automatic retry was attempted.'), blocked: true};
    if (document.querySelector('form[action*="consent"]') || /before you continue to Google|bevor Sie zu Google/i.test(text.slice(0,10000)))
      return {...failure('consent', 'Google requires consent. Open the helper tab and choose manually, then repeat your action.'), blocked: true};
    const results = [], seen = new Set();
    // Heading semantics and a real destination link, never arbitrary image links.
    for (const heading of document.querySelectorAll('#search h3, #rso h3, #search [role="heading"], #rso [role="heading"], main a h3')) {
      if (heading.closest('#tads, #tadsb, [data-text-ad], [data-ad-client], [role="navigation"], g-scrolling-carousel')) continue;
      const anchor = heading.closest('a[href]') ?? heading.querySelector('a[href]');
      if (!anchor || !heading.getClientRects().length || heading.closest('[hidden], [aria-hidden="true"]')) continue;
      let url;
      try {
        url = new URL(anchor.href);
        if (url.hostname === 'www.google.com' && url.pathname === '/url') url = new URL(url.searchParams.get('q') ?? url.searchParams.get('url') ?? '');
        if (url.protocol !== 'https:' || /(^|\.)google\.[^/]+$/.test(url.hostname) || url.username || url.password) continue;
      } catch { continue; }
      if (seen.has(url.href)) continue;
      let scope = anchor.parentElement, snippet = '';
      for (let depth = 0; scope && depth < 6; depth++, scope = scope.parentElement) {
        const candidate = scope.querySelector('.VwiC3b, .IsZvec, [data-sncf]');
        if (candidate && scope.querySelectorAll('h3, [role="heading"]').length === 1) {snippet = candidate.textContent ?? ''; break;}
      }
      const title = (heading.textContent ?? '').trim().slice(0,500);
      if (title) {results.push({title, snippet: snippet.trim().slice(0,2000), url: url.href}); seen.add(url.href);}
      if (results.length >= 30) break;
    }
    const start = Number(current.searchParams.get('start') ?? 0);
    const links = [...document.querySelectorAll('a[href]')].flatMap(anchor => {
      try {
        const u = new URL(anchor.href), offset = Number(u.searchParams.get('start'));
        return u.origin === current.origin && u.pathname === '/search' && u.searchParams.get('q') === current.searchParams.get('q') && u.searchParams.has('start') && Number.isSafeInteger(offset) && offset > start ? [{url:u.href, offset,
          next:anchor.id === 'pnnext' || anchor.getAttribute('rel') === 'next' || /next|weiter|suivant|siguiente|avanti/i.test(anchor.getAttribute('aria-label') ?? anchor.textContent ?? '')}] : [];
      } catch {return [];}
    }).sort((a,b) => Number(b.next) - Number(a.next) || a.offset - b.offset);
    const empty = /(?:did not match any documents|no results found|keine Ergebnisse|keine passenden Dokumente|keine Dokumente gefunden)/i.test(text);
    return {results, nextPage: links[0]?.url ?? null, empty: !results.length && empty, pageUrl: location.href,
      imageBlock: !!document.querySelector('#search g-scrolling-carousel img, #rso g-scrolling-carousel img, #search a[href*="imgres"]'),
      code: results.length ? 'organic_results' : empty ? 'confirmed_empty' : 'unsupported_layout'};
  };
  // Bounded observation only: never starts another navigation or search.
  return new Promise(resolve => {
    let timer, settle, observer;
    const finish = value => {clearTimeout(timer); clearTimeout(settle); observer?.disconnect(); document.removeEventListener('DOMContentLoaded', inspect); resolve(value);};
    const inspect = () => {
      clearTimeout(settle);
      const value = read();
      if (value.blocked) {finish(value); return;}
      if (value.results.length || value.empty) settle = setTimeout(() => finish(read()), 350);
    };
    observer = new MutationObserver(inspect);
    observer.observe(document.documentElement, {childList:true, subtree:true, characterData:true});
    document.addEventListener('DOMContentLoaded', inspect);
    timer = setTimeout(() => {
      const value = read();
      if (value.results.length || value.empty || value.blocked) finish(value);
      else finish({...value, error: value.imageBlock ? 'Google returned an image block without readable organic results. Images are not job cards; exhaustion is not confirmed.' : 'Google opened, but no supported organic result structure or explicit empty message appeared. This is an extraction failure, not zero jobs.',
        code: value.imageBlock ? 'non_organic_layout' : document.readyState === 'loading' ? 'slow_document' : 'unsupported_layout'});
    }, expected.timeoutMs ?? 8000);
    inspect();
  });
}
