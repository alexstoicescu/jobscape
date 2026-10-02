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
  // Follow Google's actual next-page link; do not synthesize page offsets.
  const nextPage = document.querySelector('a#pnnext, a[rel="next"]')?.href ?? null;
  return {blocked: false, results, nextPage};
}
