 const calculateMaxBurnAllowed = (
  secondaryRatio: string | null | undefined,
  canisterBal: string | null | undefined,
  canisterArchivedBal: Number | null | undefined,
  canisterUnClaimedIcp: Number | null | undefined
) => {
  // Removed debug logging
  
  // Safe number conversion with defaults
  const safeRatio = Number(secondaryRatio) || 0;
  const safeCanisterBal = Number(canisterBal) || 0;
  const safeArchivedBal = Number(canisterArchivedBal) || 0;
  const safeUnclaimedIcp = Number(canisterUnClaimedIcp) || 0;
  
  // Handle invalid values
  if (isNaN(safeRatio) || isNaN(safeCanisterBal) || isNaN(safeArchivedBal) || isNaN(safeUnclaimedIcp)) {
    // Invalid values detected, returning 0
    return 0;
  }
  
  // If secondary ratio is 0 or invalid, no burning is possible
  if (safeRatio <= 0) {
    return 0;
  }
  
  let lbryPerIcp = safeRatio * 2;
  let remainingBalance = safeCanisterBal - (safeUnclaimedIcp + safeArchivedBal);
  
  // Backend does NOT reserve 50% for burns
  // Burning actually increases ICP reserves, so full remaining balance is available
  let actualAvailable = remainingBalance;
  let maxAllowed = actualAvailable * lbryPerIcp;
  
  // Calculation complete
  
  // Ensure non-negative result
  if (maxAllowed < 0 || isNaN(maxAllowed)) {
    return 0;
  }
  
  return maxAllowed;
};
 export default calculateMaxBurnAllowed;