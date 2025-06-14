import React, { useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import "./style.css"

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
import InfoCard from './components/info/InfoCard';

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
        { id: 1, path: 'balance', label: 'Balance', hover: null, content: <BalanceContent /> },
        { id: 2, path: 'swap', label: 'Swap', hover: `Swap ICP for ${swap.activeSwapPool&&swap.activeSwapPool[1].secondary_token_symbol}`, content: <SwapContent /> },
        { id: 4, path: 'send', label: 'Send', hover: null, content: <SendContent /> },
        { id: 5, path: 'receive', label: 'Receive', hover: null, content: <ReceiveContent /> },
        { id: 6, path: 'burn', label: 'Burn', hover: `Burn ${swap.activeSwapPool&&swap.activeSwapPool[1].secondary_token_symbol}, get back ${swap.activeSwapPool&&swap.activeSwapPool[1].primary_token_symbol} and ICP`, content: <BurnContent /> },
        { id: 7, path: 'stake', label: 'Stake', hover: null, content: <StakeContent /> },
        { id: 8, path: 'redeem', label: 'Redeem', hover: "Redeem ICP if your swap fails", content: <RedeemContent /> },
        { id: 9, path: 'history', label: 'Transaction history', hover: null, content: <TransactionHistory /> },
        { id: 10, path: 'insights', label: 'Insights', hover: null, content: <Insights /> },
        { id: 11, path: 'info', label: 'Info', hover: null, content: <InfoCard /> }
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
            navigate('/');
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
        } else if (lbryFunSuccess) {
            if (swap.activeSwapPool !== null) {
                dispatch(setActiveSwapPool(null));
            }
        }
    }, [idFromUrl, tokenPools, lbryFunLoading, lbryFunError, dispatch, swap.activeSwapPool, lbryFunSuccess, navigate]);

    return (
        <div className='tabs py-10 2xl:py-20 xl:py-16 lg:py-14 md:py-12 sm:py-10'>
            <div className='container px-5'>
                <AccountCards />
                <div className='tabs-content'>
                    <div className='tabs-content'>
                        <div className="flex mb-5 flex-wrap">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => navigate(`/swap/${tab.path}?id=${idFromUrl}`)}
                                    className={`px-2 py-2 flex items-center ${activeTab === tab.id
                                        ? 'text-base 2xl:text-xl bg-interactive-primary text-primary-foreground px-5'
                                        : 'bg-background text-foreground'} transition-colors duration-300 text-base font-semibold leading-6 min-w-24 h-11 border border-border rounded-2xl mr-3 hover:bg-interactive-primary hover:text-primary-foreground px-5 mb-4 z-20`}
                                >
                                    {tab.label}
                                    {tab.hover === null ? (<></>) : (<div className='relative group'>
                                        <FontAwesomeIcon icon={faQuestionCircle} className='text-muted-foreground text-2xl ml-3 position-relative' />
                                        <span className='bg-popover text-popover-foreground p-3 rounded-2xl absolute bottom-12 left-1/2 -translate-x-1/2 text-xs font-light w-52 z-10 invisible group-hover:visible before:content-[" "] before:block before:absolute before:border-l-[10px] before:border-l-transparent before:border-r-[10px] before:border-r-transparent before:border-b-[20px] before:border-b-popover before:rotate-180 before:-bottom-5 before:left-1/2 before:-translate-x-1/2'>{tab.hover}</span>
                                    </div>)}
                                </button>
                            ))}
                        </div>

                        <div className="mt-4">
                            {tabs.find(tab => tab.path === currentPath)?.content}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SwapMain;
