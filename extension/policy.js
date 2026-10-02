import {platforms} from './platforms.js';
export const origins = new Set(['http://127.0.0.1:5173', 'http://localhost:5173']);
export function allowedSender(sender) {
  try { return sender.frameId === 0 && origins.has(new URL(sender.url).origin); } catch { return false; }
}
export function validateSearch(message) {
  const ids = message.platforms;
  if (!Array.isArray(ids) || !ids.length || ids.length > platforms.length ||
      ids.some(id => !platforms.some(p => p.id === id)) || new Set(ids).size !== ids.length)
    throw new Error('Select valid ATS platforms.');
  const prefix = '(' + platforms.filter(p => ids.includes(p.id)).flatMap(p => p.domains).map(d => 'site:' + d).join(' OR ') + ') ';
  if (typeof message.query !== 'string' || message.query.length > 4096 ||
      !message.query.startsWith(prefix) || !message.query.slice(prefix.length).trim() || /[\x00-\x1f]/.test(message.query))
    throw new Error('Invalid combined query.');
  return {query: message.query, platforms: ids};
}
export function destination(raw, ids) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    const source = platforms.find(p => ids.includes(p.id) && p.domains.some(domain => {
      const [host, ...path] = domain.split('/');
      const prefix = path.length ? '/' + path.join('/') : '';
      return (u.hostname === host || u.hostname.endsWith('.' + host)) &&
        (!prefix || u.pathname === prefix || u.pathname.startsWith(prefix + '/'));
    }));
    if (!source) return null;
    u.hash = '';
    for (const name of [...u.searchParams.keys()]) if (/^(utm_|gclid$|fbclid$)/i.test(name)) u.searchParams.delete(name);
    u.searchParams.sort();
    return {url: u.href, platform: source.id};
  } catch { return null; }
}
