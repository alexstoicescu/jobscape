import {readFileSync, writeFileSync} from 'node:fs';
import {sourceModule} from './load-source.mjs';
const {platforms} = await import(sourceModule('../lib/search.ts'));
writeFileSync(new URL('../extension/platforms.js', import.meta.url), '// Generated from lib/search.ts by scripts/extension-platforms.mjs.\nexport const platforms = ' + JSON.stringify(platforms.map(({id, name, domains}) => ({id, name, domains})), null, 2) + ';\n');
const manifestUrl = new URL('../extension/manifest.json', import.meta.url);
const manifest = JSON.parse(readFileSync(manifestUrl, 'utf8'));
manifest.host_permissions = ['https://www.google.com/*', ...new Set(platforms.flatMap(p => p.domains.map(domain => {
  const [host, ...path] = domain.split('/');
  return 'https://*.' + host + '/' + (path.length ? path.join('/') + '*' : '*');
})))];
writeFileSync(manifestUrl, JSON.stringify(manifest, null, 2) + '\n');
