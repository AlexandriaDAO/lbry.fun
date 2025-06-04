import { combineReducers } from "@reduxjs/toolkit";
import authReducer from "@/features/auth/authSlice";
import loginReducer from "@/features/login/loginSlice";
import swapReducer from "@/features/swap/swapSlice"
import icpLedgerReducer from "@/features/icp-ledger/icpLedgerSlice";
import tokenomicsReducer from "@/features/swap/tokenomicsSilce";
import primaryReducer from "@/features/swap/primarySlice";
import lbryFunReducer from "@/features/token/lbryFunSlice";
import uiReducer from './slices/uiSlice';


const rootReducer = combineReducers({
	auth: authReducer,
	login: loginReducer,
	swap:swapReducer,
	icpLedger:icpLedgerReducer,
	tokenomics:tokenomicsReducer,
	primary:primaryReducer,
	lbryFun:lbryFunReducer,
    ui: uiReducer,
});

export default rootReducer;
