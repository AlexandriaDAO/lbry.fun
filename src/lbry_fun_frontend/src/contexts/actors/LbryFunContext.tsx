import { createActorContext } from "ic-use-actor";

import { _SERVICE } from "../../../../declarations/lbry_fun/lbry_fun.did";

const LbryFunContext = createActorContext<_SERVICE>();

export default LbryFunContext;