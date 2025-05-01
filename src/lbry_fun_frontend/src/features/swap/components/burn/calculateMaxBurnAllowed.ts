 const calculateMaxBurnAllowed = (
  secondaryRatio: string,
  canisterBal: string,
  canisterArchivedBal: Number,
  canisterUnClaimedIcp: Number
) => {
  console.log("secondaryRatio", secondaryRatio);
  console.log("canisterBal", canisterBal);
  console.log("canisterArchivedBal", canisterArchivedBal);
  console.log("canisterUnClaimedIcp", canisterUnClaimedIcp);
  let lbryPerIcp = Number(secondaryRatio) * 2;
  let canisterBalance = Number(canisterBal);
  let totalArchivedBalance = Number(canisterArchivedBal);
  let totalUnclaimedBalance = Number(canisterUnClaimedIcp);
  let remainingBalance =
    canisterBalance - (totalUnclaimedBalance + totalArchivedBalance);
  let actualAvailable = remainingBalance / 2; // 50% for stakers
  let maxAllowed = actualAvailable * lbryPerIcp;
  if (maxAllowed < 0) {
    return 0;
  }
  return maxAllowed;
};
 export default calculateMaxBurnAllowed;