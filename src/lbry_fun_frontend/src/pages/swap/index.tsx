import React, { useEffect } from 'react';
import Swap from '@/features/swap';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { setActiveSwapPool } from '@/features/swap/store/swapSlice';

const SwapPage = () => {
  const dispatch = useAppDispatch();

  // Clear activeSwapPool and other state when leaving the swap page
  useEffect(() => {
    return () => {
      dispatch(setActiveSwapPool(null));
      localStorage.removeItem('tab');
    };
  }, [dispatch]);

  return (
    <main>
      <Swap/>
    </main>
  );
}

export default SwapPage;
