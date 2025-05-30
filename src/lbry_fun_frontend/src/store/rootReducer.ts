import { combineReducers } from "@reduxjs/toolkit";
import authReducer from "@/features/auth/authSlice";
import loginReducer from "@/features/login/loginSlice";
import signupReducer from "@/features/signup/signupSlice";
import swapReducer from "@/features/swap/swapSlice"
import icpLedgerReducer from "@/features/icp-ledger/icpLedgerSlice";
import tokenomicsReducer from "@/features/swap/tokenomicsSilce";
import primaryReducer from "@/features/swap/primarySlice";
import lbryFunReducer from "@/features/token/thunk/lbryFunSlice";


const rootReducer = combineReducers({
	auth: authReducer,
	login: loginReducer,
	signup: signupReducer,
	swap:swapReducer,
	icpLedger:icpLedgerReducer,
	tokenomics:tokenomicsReducer,
	primary:primaryReducer,
	lbryFun:lbryFunReducer
});

export default rootReducer;
