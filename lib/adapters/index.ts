import type {BoardAdapter} from './types';
import {greenhouse,lever,ashby} from './legacy';
import {smartrecruiters} from './smartrecruiters';
import {workable} from './workable';
import {personio} from './personio';

// A capability becomes live only when its adapter and verified registry work.
export const adapters:Record<string,BoardAdapter>={greenhouse,lever,ashby,smartrecruiters,workable,personio};
