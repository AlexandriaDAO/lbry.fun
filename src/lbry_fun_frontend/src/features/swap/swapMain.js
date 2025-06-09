import React, { useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import "./style.css";
import { useAppSelector } from '@/store/hooks/useAppSelector';
import AccountCards from './components/balance/accountCards';
import BalanceContent from './components/balance/balanceContent';
import SwapContent from './components/swap/swapContent';
import SendContent from './components/send/sendContent';
import BurnContent from './components/burn/burnContent';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import getSecondaryratio from './thunks/getSecondaryratio';
import getPrimaryMintRate from './thunks/tokenomics/getPrimaryMintRate';
import StakeContent from './components/stake/stakeContent';
import ReceiveContent from './components/receive/receiveContent';
import RedeemContent from './components/redeem/redeemContent';
import TransactionHistory from './components/transactionHistory/transactionHistory';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-regular-svg-icons';
import getSecondaryFee from './thunks/secondaryIcrc/getSecondaryFee';
import getPrimaryFee from './thunks/primaryIcrc/getPrimaryFee';
import Insights from './components/insights/insights';
import getTokenPools from '../token/thunk/getTokenPools.thunk';
import { setActiveSwapPool } from './swapSlice';
import fetchTokenLogosForPool from '../token/thunk/fetchTokenLogosForPoolThunk';
const SwapMain = () => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const swap = useAppSelector(state => state.swap);
    const { tokenPools, loading: lbryFunLoading, error: lbryFunError, success: lbryFunSuccess } = useAppSelector((state) => state.lbryFun);
    const idFromUrl = searchParams.get("id");
    const tabs = [
        { id: 1, path: 'balance', label: 'Balance', hover: null, content: React.createElement(BalanceContent, null) },
        { id: 2, path: 'swap', label: 'Swap', hover: `Swap ICP for ${swap.activeSwapPool && swap.activeSwapPool[1].secondary_token_symbol}`, content: React.createElement(SwapContent, null) },
        { id: 4, path: 'send', label: 'Send', hover: null, content: React.createElement(SendContent, null) },
        { id: 5, path: 'receive', label: 'Receive', hover: null, content: React.createElement(ReceiveContent, null) },
        { id: 6, path: 'burn', label: 'Burn', hover: `Burn ${swap.activeSwapPool && swap.activeSwapPool[1].secondary_token_symbol}, get back ${swap.activeSwapPool && swap.activeSwapPool[1].primary_token_symbol} and ICP`, content: React.createElement(BurnContent, null) },
        { id: 7, path: 'stake', label: 'Stake', hover: null, content: React.createElement(StakeContent, null) },
        { id: 8, path: 'redeem', label: 'Redeem', hover: "Redeem ICP if your swap fails", content: React.createElement(RedeemContent, null) },
        { id: 9, path: 'history', label: 'Transaction history', hover: null, content: React.createElement(TransactionHistory, null) },
        { id: 10, path: 'insights', label: 'Insights', hover: null, content: React.createElement(Insights, null) }
    ];
    const currentPath = location.pathname.split('/').pop() || 'balance';
    const activeTab = tabs.find(tab => tab.path === currentPath)?.id || 1;
    useEffect(() => {
        dispatch(getSecondaryratio());
        dispatch(getPrimaryMintRate());
        dispatch(getSecondaryFee());
        dispatch(getPrimaryFee());
        if (localStorage.getItem("tab")) {
            navigate('/swap/stake');
            localStorage.removeItem("tab");
        }
    }, []);
    useEffect(() => {
        if (tokenPools.length === 0 && !lbryFunLoading && !lbryFunError) {
            dispatch(getTokenPools());
        }
    }, [dispatch, tokenPools.length, lbryFunLoading, lbryFunError]);
    useEffect(() => {
        if (swap.burnSuccess === true) {
            dispatch(getSecondaryratio());
        }
    }, [swap]);
    useEffect(() => {
        if (!idFromUrl) {
            if (swap.activeSwapPool !== null) {
                dispatch(setActiveSwapPool(null));
            }
            return;
        }
        if (lbryFunLoading || lbryFunError) {
            return;
        }
        const pool = tokenPools.find((p) => p[0] === idFromUrl);
        if (pool) {
            if (!swap.activeSwapPool || swap.activeSwapPool[0] !== pool[0]) {
                dispatch(setActiveSwapPool(pool));
                const poolData = pool[1];
                if ((poolData.primary_token_id && !poolData.primary_token_logo_base64) ||
                    (poolData.secondary_token_id && !poolData.secondary_token_logo_base64)) {
                    dispatch(fetchTokenLogosForPool({
                        poolId: pool[0],
                        primaryTokenId: poolData.primary_token_id,
                        secondaryTokenId: poolData.secondary_token_id,
                    }));
                }
            }
        }
        else {
            if (swap.activeSwapPool !== null) {
                dispatch(setActiveSwapPool(null));
            }
        }
    }, [idFromUrl, tokenPools, lbryFunLoading, lbryFunError, dispatch, swap.activeSwapPool]);
    return (React.createElement("div", { className: 'tabs py-10 2xl:py-20 xl:py-16 lg:py-14 md:py-12 sm:py-10' },
        React.createElement("div", { className: 'container px-5' },
            React.createElement(AccountCards, null),
            React.createElement("div", { className: 'tabs-content' },
                React.createElement("div", { className: 'tabs-content' },
                    React.createElement("div", { className: "flex mb-5 flex-wrap" }, tabs.map(tab => (React.createElement("button", { key: tab.id, onClick: () => navigate(`/swap/${tab.path}?id=${idFromUrl}`), className: `px-2 py-2 flex items-center ${activeTab === tab.id
                            ? 'text-base 2xl:text-xl bg-[#5555FF] text-white dark:bg-white dark:text-black px-5'
                            : 'bg-white text-black dark:bg-black dark:text-white'} transition-colors duration-300 text-base font-semibold leading-6 min-w-24 h-11 border dark:border-gray-700 border-gray-400 rounded-2xl mr-3 hover:bg-[#5555FF] hover:text-white dark:hover:bg-white dark:hover:text-black px-5 mb-4 z-20` },
                        tab.label,
                        tab.hover === null ? (React.createElement(React.Fragment, null)) : (React.createElement("div", { className: 'relative group' },
                            React.createElement(FontAwesomeIcon, { icon: faQuestionCircle, className: 'text-[#cccccc] dark:text-gray-400 text-2xl ml-3 position-relative' }),
                            React.createElement("span", { className: 'bg-[#C5CFF9] dark:bg-gray-700 text-black dark:text-white p-3 rounded-2xl absolute bottom-12 left-1/2 -translate-x-1/2 text-xs font-light w-52 z-10 invisible group-hover:visible before:content-[" "] before:block before:absolute before:border-l-[10px] before:border-l-transparent before:border-r-[10px] before:border-r-transparent before:border-b-[20px] before:border-b-[#C5CFF9] dark:before:border-b-gray-700 before:rotate-180 before:-bottom-5 before:left-1/2 before:-translate-x-1/2' }, tab.hover))))))),
                    React.createElement("div", { className: "mt-4" }, tabs.find(tab => tab.path === currentPath)?.content))))));
};
export default SwapMain;
