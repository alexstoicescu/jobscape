import {platforms, type SearchInput} from './search';

export type Candidate = {title: string; snippet: string; url: string; platform: string; key: string};
export type DiscoveryPage = {
  query: string; session: string; page: number; results: Candidate[]; hasMore: boolean;
  stopReason?: string; warning?: string; rawCount: number; rejected: number; duplicates: number;
  usage: {request: number; search: number; daily: number; monthly: number; total: number;
    dailyLimit: number; monthlyLimit: number; totalLimit: number; searchLimit: number; cached: boolean; providerCredits: number | null};
};
export type DiscoveryInput = {input: SearchInput; region: 'All'|'Global'|'EU'|'EMEA'|'APAC'|'US'};

// Domain membership alone is insufficient: career homepages are not postings.
// Keep the original URL for navigation; the separate key handles tracking/locale aliases.
export function atsPosting(raw: string, ids: string[]) {
  try {
    if (raw.length > 4096) return null;
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    const source = platforms.find(p => ids.includes(p.id) && p.domains.some(domain => {
      const [host, ...parts] = domain.split('/');
      const prefix = parts.length ? '/' + parts.join('/') : '';
      return (u.hostname === host || u.hostname.endsWith('.' + host)) &&
        (!prefix || u.pathname.startsWith(prefix + '/'));
    }));
    if (!source) return null;
    const p = u.pathname;
    let id: string | undefined;
    const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
    switch (source.id) {
      case 'greenhouse': id = p.match(/^\/([^/]+)\/jobs\/(\d+)/)?.slice(1).join(':');
        if (!id && p === '/embed/job_app' && u.searchParams.get('for') && /^\d+$/.test(u.searchParams.get('token') ?? '')) id = u.searchParams.get('for') + ':' + u.searchParams.get('token');
        break;
      case 'lever': case 'ashby': id = p.match(new RegExp('^/([^/]+)/(' + uuid + ')(?:/|$)', 'i'))?.slice(1).join(':'); break;
      case 'workday': {const m = p.match(/\/([^/]+)\/job\/.+\/([^/]+?)(_R[^/]+)(?:\/apply)?$/i); if (m) id = m[1] + ':' + m[3]; break;}
      case 'smartrecruiters': id = p.match(/^\/([^/]+)\/(\d+)[^/]*/)?.slice(1).join(':'); break;
      case 'workable': id = p.match(/^\/([^/]+)\/j\/([a-z0-9]+)/i)?.slice(1).join(':'); break;
      case 'recruitee': id = p.match(/^\/o\/([^/]+)/)?.[1]; break;
      case 'personio': id = p.match(/^\/job\/(\d+)/)?.[1]; break;
      case 'icims': id = p.match(/\/jobs\/(\d+)\//)?.[1]; break;
      case 'jobvite': id = p.match(/^\/([^/]+)\/job\/([^/]+)/)?.slice(1).join(':'); break;
      case 'breezy': id = p.match(/^\/p\/([^/]+)/)?.[1]; break;
      case 'jazzhr': id = p.match(/^\/apply\/([^/]+)/)?.[1]; break;
      case 'taleo': if (/jobdetail/i.test(p)) id = u.searchParams.get('job') ?? undefined; break;
      case 'bamboohr': id = p.match(/^\/careers\/(\d+)/)?.[1]; break;
      case 'teamtailor': id = p.match(/^\/jobs\/(\d+)/)?.[1]; break;
      case 'paylocity': id = p.match(/\/Jobs\/Details\/(\d+)/i)?.[1]; break;
      case 'adp': if (/recruitment/i.test(p)) id = u.searchParams.get('jobId') ?? undefined; break;
      case 'successfactors': id = p.match(/\/job\/.+\/(\d+)\/?$/)?.[1] ?? u.searchParams.get('career_job_req_id') ?? undefined; break;
    }
    if (!id || id.length > 400 || /[\x00-\x20]/.test(id)) return null;
    return {url: raw, platform: source.id, key: source.id + ':' + (source.id === 'greenhouse' || source.id === 'lever' || source.id === 'ashby' ? '' : u.hostname + ':') + id.toLowerCase()};
  } catch {return null;}
}

export function appendCandidates(previous: Candidate[], incoming: Candidate[]) {
  const seen = new Set(previous.map(row => row.key));
  return [...previous, ...incoming.filter(row => {if (seen.has(row.key)) return false; seen.add(row.key); return true;})];
}
