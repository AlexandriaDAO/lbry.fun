 const calculateMaxBurnAllowed = (
  secondaryRatio: string,
  canisterBal: string,
  canisterArchivedBal: Number,
  canisterUnClaimedIcp: Number
) => {
  console.log("Burn calculation debug:", {
    secondaryRatio,
    canisterBal,
    canisterArchivedBal,
    canisterUnClaimedIcp
  });
  
  let lbryPerIcp = Number(secondaryRatio) * 2;
  let canisterBalance = Number(canisterBal);
  let totalArchivedBalance = Number(canisterArchivedBal);
  let totalUnclaimedBalance = Number(canisterUnClaimedIcp);
  let remainingBalance =
    canisterBalance - (totalUnclaimedBalance + totalArchivedBalance);
  
  // Backend does NOT reserve 50% for burns
  // Burning actually increases ICP reserves, so full remaining balance is available
  let actualAvailable = remainingBalance;
  let maxAllowed = actualAvailable * lbryPerIcp;
  
  console.log("Burn calculation result:", {
    remainingBalance,
    actualAvailable,
    maxAllowed,
    lbryPerIcp
  });
  
  if (maxAllowed < 0) {
    return 0;
  }
  return maxAllowed;
};
 export default calculateMaxBurnAllowed;