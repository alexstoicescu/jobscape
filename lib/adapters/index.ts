import type {BoardAdapter} from './types';
import {greenhouse,lever,ashby} from './legacy';

// A capability becomes live only when its adapter and verified registry work.
export const adapters:Record<string,BoardAdapter>={greenhouse,lever,ashby};
