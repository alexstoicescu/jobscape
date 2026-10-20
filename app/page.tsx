import {env} from 'cloudflare:workers';
import DiscoverySearch from '@/components/discovery-search';
import Prototype from './prototype/page';

export default function Home() {
  return (env as {JOBSCAPE_DISCOVERY?:string}).JOBSCAPE_DISCOVERY === 'serper'
    ? <DiscoverySearch enabled={true}/>
    : <Prototype/>;
}
