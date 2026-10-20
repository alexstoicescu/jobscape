import {env} from 'cloudflare:workers';
import DiscoverySearch from '@/components/discovery-search';

export default function Home() {
  return <DiscoverySearch enabled={(env as {JOBSCAPE_DISCOVERY?:string}).JOBSCAPE_DISCOVERY === 'serper'}/>;
}
