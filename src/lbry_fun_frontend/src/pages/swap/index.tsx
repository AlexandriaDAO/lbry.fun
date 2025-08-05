import React, { useEffect } from 'react';
import Swap from '@/features/swap';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';

const SwapPage = () => {
  const dispatch = useAppDispatch();

  // Only clear localStorage when leaving the page
  useEffect(() => {
    return () => {
      // Don't clear activeSwapPool here as it causes issues with staking
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
