import {writeFileSync} from 'node:fs';
import {sourceModule} from './load-source.mjs';
const {platforms} = await import(sourceModule('../lib/search.ts'));
writeFileSync(new URL('../extension/platforms.js', import.meta.url), '// Generated from lib/search.ts by scripts/extension-platforms.mjs.\nexport const platforms = ' + JSON.stringify(platforms.map(({id, name, domains}) => ({id, name, domains})), null, 2) + ';\n');
