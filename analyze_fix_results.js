// Analyze the fixed tokenomics output

const E8S = 100_000_000;

// From the new output
const epoch1_minted = 20_000_000_000_000n;
const epoch1_natural = Number(epoch1_minted) / E8S;

console.log("Epoch 1 Results:");
console.log("- Minted (E8S):", epoch1_minted.toString());
console.log("- Minted (natural):", epoch1_natural.toLocaleString());
console.log("- Expected: 200,000");
console.log("- Match?", epoch1_natural === 200_000);

// Check total supply
const total_supply_y = 1_000_020_000_000_000_000n;
const tge = 1_000_000_000_000_000_000n;
const actual_minted = total_supply_y - tge;
const actual_minted_natural = Number(actual_minted) / E8S;

console.log("\nTotal Supply:");
console.log("- TGE (natural):", Number(tge) / E8S);
console.log("- Minted (natural):", actual_minted_natural.toLocaleString());
console.log("- Total (natural):", Number(total_supply_y) / E8S);

// Check percentage
const max_supply = 100_000_000_000_000n; // 1M tokens in E8S
const percentage = (Number(actual_minted) / Number(max_supply)) * 100;
console.log("- Percentage of max supply:", percentage.toFixed(2) + "%");

console.log("\nIssue: Still only showing 1 epoch instead of 4!");
console.log("Only 20% of supply minted instead of 100%");