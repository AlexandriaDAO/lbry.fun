import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRightLong } from "@fortawesome/free-solid-svg-icons";
import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux/dist/react-redux";
interface BurnInfoProps {
  maxBurnAllowed: Number;
}
const BurnInfo: React.FC<BurnInfoProps> = ({ maxBurnAllowed }) => {
  const swap = useAppSelector((state) => state.swap);
  const tokenomics = useAppSelector((state) => state.tokenomics);

  return (<>

    <div className='ms-0 2xl:ms-3 xl:ms-3 lg:ms-3 md:ms-3 sm:ms-0'>
      <div className='border border-gray-400 border-gray-600 bg-white bg-gray-800 py-5 px-5 rounded-2xl'>
        <ul className='ps-0'>
          <li className='flex justify-between mb-5'>
            <strong className='lg:text-lg md:text-base sm:text-sm font-medium me-1 text-black text-gray-200'>Max  {swap.activeSwapPool&& swap.activeSwapPool[1]?.secondary_token_name} Burn allowed:</strong>
            <span className='lg:text-lg md:text-base sm:text-sm font-medium text-black text-gray-200'>{maxBurnAllowed.toFixed(4)}  {swap.activeSwapPool&& swap.activeSwapPool[1]?.secondary_token_name}</span>
          </li>
          <li className='flex justify-between mb-5'>
            <strong className='lg:text-lg md:text-base sm:text-sm font-medium me-1 text-black text-gray-200'>{Number(swap.secondaryRatio).toFixed(4)} Secondary
              <span className='mx-2'><FontAwesomeIcon icon={faArrowRightLong} className="text-gray-200" /></span>0.5 ICP/
            </strong>
          </li>
          <li className='flex justify-between mb-5'>
            
            <strong className='lg:text-lg md:text-base sm:text-sm font-medium me-1 text-black text-gray-200'>1  {swap.activeSwapPool&& swap.activeSwapPool[1]?.secondary_token_symbol}
              <span className='mx-2'><FontAwesomeIcon icon={faArrowRightLong} className="text-gray-200" /></span>{tokenomics.primaryMintRate}  {swap.activeSwapPool&& swap.activeSwapPool[1]?.primary_token_name}
            </strong>
          </li>
          <li className='flex justify-between'>
            <strong className='lg:text-lg md:text-base sm:text-sm font-medium me-1 text-black text-gray-200'>Network Fees</strong>
            <span className='lg:text-lg md:text-base sm:text-sm font-medium text-black text-gray-200'><span className='text-multycolor text-blue-400'>{swap.secondaryFee}</span>  {swap.activeSwapPool&& swap.activeSwapPool[1]?.secondary_token_symbol}</span>
          </li>
        </ul>
      </div>
    </div>

  </>)

};
export default BurnInfo;
