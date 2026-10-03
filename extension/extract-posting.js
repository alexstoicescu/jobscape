// Only injected into the owned, URL-validated posting tab after an explicit click.
// Cache inert text/blocks/HTTPS links for a future reader, never executable HTML.
export async function extractPosting() {
  function read() {
    if (document.querySelector('iframe[src*="recaptcha"], #captcha-form') || /access denied|verify you are human|checking your browser/i.test(document.body?.innerText?.slice(0,3000) ?? ''))
      return {error: 'Posting requires access or verification.'};
    if (/job (?:is no longer|not found)|no longer accepting applications|position has been (?:filled|closed)/i.test(document.body?.innerText?.slice(0,3000) ?? ''))
      return {error: 'The original posting appears unavailable or closed.'};
    let job;
    function find(value, depth = 0) {
      if (!value || typeof value !== 'object' || depth > 8 || job) return;
      if ([value['@type']].flat().includes('JobPosting') && typeof value.description === 'string') {job = value; return;}
      for (const child of Object.values(value).slice(0,200)) if (child && typeof child === 'object') {
        if (Array.isArray(child)) child.slice(0,100).forEach(item => find(item, depth + 1)); else find(child, depth + 1);
      }
    }
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      if ((script.textContent?.length ?? 0) > 1000000) continue;
      try {const data = JSON.parse(script.textContent); if (Array.isArray(data)) data.forEach(item => find(item)); else find(data);} catch { /* Invalid structured data is not proof. */ }
    }
    const root = job ? new DOMParser().parseFromString(job.description, 'text/html').body :
      document.querySelector('[data-testid="job-description"], [class*="jobDescription"], [class*="job-description"], .posting-page .content, [role="tabpanel"], main article');
    if (!root || !(root.textContent ?? '').trim()) return null;
    const clean = root.cloneNode(true);
    clean.querySelectorAll('script,style,noscript,template,iframe,svg,object,form,button,input,nav,footer,header').forEach(node => node.remove());
    const elements = [...clean.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote')].filter(node => !node.querySelector('h1,h2,h3,h4,h5,h6,p,li,blockquote'));
    let blocks = elements.map(node => ({kind: node.closest('li') ? 'li' : node.tagName.toLowerCase(), text: (node.textContent ?? '').trim()})).filter(block => block.text);
    if (!blocks.length) blocks = [{kind: 'p', text: (clean.textContent ?? '').trim()}];
    const fullText = blocks.map(block => block.text).join('\n');
    if (fullText.length < 150) return null;
    const links = [...clean.querySelectorAll('a[href]')].flatMap(anchor => {
      try {const u = new URL(anchor.getAttribute('href'), location.href); return u.protocol === 'https:' && !u.username && !u.password && u.href.length <= 2000 ? [{text: (anchor.textContent ?? '').trim().slice(0,300), url: u.href}] : [];} catch {return [];}
    }).slice(0,100);
    const names = value => [value].flat().flatMap(item => {
      if (typeof item === 'string') return [item];
      if (!item || typeof item !== 'object') return [];
      const address = item.address ?? item;
      const country = address.addressCountry;
      return [typeof country === 'string' ? country : country?.name, item.name, address.addressLocality].filter(text => typeof text === 'string' && text.trim());
    }).map(text => text.trim().slice(0,300)).slice(0,50);
    const locations = job ? names(job.jobLocation) : [];
    const requirements = job ? names(job.applicantLocationRequirements) : [];
    const remote = job?.jobLocationType ? [job.jobLocationType].flat().some(value => String(value).toUpperCase() === 'TELECOMMUTE') : null;
    const truncated = fullText.length > 100000 || blocks.length > 1000;
    let remaining = 100000;
    blocks = blocks.slice(0,1000).flatMap(block => {const text = block.text.slice(0,Math.min(10000, remaining)); remaining -= text.length; return text ? [{...block, text}] : [];});
    return {title: String(job?.title ?? document.querySelector('h1')?.textContent ?? document.title).trim().slice(0,500),
      text: fullText.slice(0,100000), blocks, links, locations, requirements, remote,
      truncated: truncated || elements.some(node => (node.textContent?.length ?? 0) > 10000), method: job ? 'structured' : 'page'};
  }
  const immediate = read();
  if (immediate) return immediate;
  // A bounded, event-driven wait for a SPA to render. No polling or navigation retries.
  return new Promise(resolve => {
    const finish = value => {clearTimeout(timer); observer.disconnect(); resolve(value);};
    const observer = new MutationObserver(() => {const result = read(); if (result) finish(result);});
    const timer = setTimeout(() => finish({error: 'No readable full job description appeared within eight seconds.'}), 8000);
    observer.observe(document.documentElement, {childList: true, subtree: true});
  });
}
