import { createUseActorHook } from 'ic-use-actor';
import { _SERVICE } from "../../../../declarations/lbry_fun/lbry_fun.did";
import { LbryFunContext } from '@/contexts/actors';

const useLbryFun = createUseActorHook<_SERVICE>(LbryFunContext);

export default useLbryFun;