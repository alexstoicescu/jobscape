// Self-contained function injected only into the extension-owned Google tab.
export function extractGoogle() {
  const text = document.body?.innerText ?? '';
  if (location.pathname.startsWith('/sorry') || document.querySelector('form[action*="consent"], iframe[src*="recaptcha"], #captcha-form') ||
      /unusual traffic|before you continue to Google/i.test(text.slice(0,10000)))
    return {blocked: true, results: []};
  const results = [];
  for (const heading of document.querySelectorAll('#search h3, #rso h3')) {
    const anchor = heading.closest('a');
    if (!anchor) continue;
    let url = anchor.href;
    try {
      const u = new URL(url);
      if (u.hostname === 'www.google.com' && u.pathname === '/url') url = u.searchParams.get('q') ?? u.searchParams.get('url') ?? '';
    } catch { continue; }
    let scope = anchor.parentElement;
    let snippet = '';
    for (let depth = 0; scope && depth < 6; depth++, scope = scope.parentElement) {
      const candidate = scope.querySelector('.VwiC3b, .IsZvec, [data-sncf]');
      if (candidate && scope.querySelectorAll('h3').length === 1) { snippet = candidate.textContent ?? ''; break; }
    }
    const title = (heading.textContent ?? '').trim().slice(0,500);
    if (title) results.push({title, snippet: snippet.trim().slice(0,2000), url});
    if (results.length >= 30) break;
  }
  // Inspect actual next/numbered search links before offering an offset attempt.
  const current = new URL(location.href), start = Number(current.searchParams.get('start') ?? 0);
  const links = [...document.querySelectorAll('a[href]')].flatMap(anchor => {
    try {
      const u = new URL(anchor.href);
      const offset = Number(u.searchParams.get('start'));
      return u.origin === current.origin && u.pathname === '/search' && u.searchParams.get('q') === current.searchParams.get('q') &&
        u.searchParams.has('start') && Number.isSafeInteger(offset) && offset > start ? [{url:u.href, offset,
          next:anchor.id === 'pnnext' || anchor.getAttribute('rel') === 'next' || /next|weiter|suivant|siguiente|avanti/i.test(anchor.getAttribute('aria-label') ?? anchor.textContent ?? '')}] : [];
    } catch {return [];}
  }).sort((a,b) => Number(b.next) - Number(a.next) || a.offset - b.offset);
  const empty = /(?:did not match any documents|no results found|keine Ergebnisse|keine passenden Dokumente|keine Dokumente gefunden)/i.test(text);
  return {blocked: false, results, nextPage: links[0]?.url ?? null, empty,
    error: !results.length && !empty ? 'Google result markup could not be extracted; this is not confirmed exhaustion.' : undefined};
}
