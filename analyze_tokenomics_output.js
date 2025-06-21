// Analyze the tokenomics output to understand what's happening

const E8S = 100_000_000;

// From the output
const minted_per_epoch_y = [864_712_049_423_024_128n];

// Convert to natural units
const epoch1_minted_e8s = minted_per_epoch_y[0];
const epoch1_minted_natural = Number(epoch1_minted_e8s) / E8S;

console.log("Epoch 1 minted (E8S):", epoch1_minted_e8s.toString());
console.log("Epoch 1 minted (natural):", epoch1_minted_natural.toLocaleString());
console.log("Expected (natural): 200,000");

// The number looks like it might be including some scaling
const weird_factor = Number(epoch1_minted_e8s) / 200_000;
console.log("\nWeird scaling factor:", weird_factor.toLocaleString());
console.log("Weird factor / E8S:", weird_factor / E8S);

// Check if this is 18.6 billion in E8S
const billions_check = 18.6e9 * E8S;
console.log("\n18.6 billion in E8S:", billions_check.toExponential());
console.log("Our value:", epoch1_minted_e8s.toString());
console.log("Match?", Math.abs(Number(epoch1_minted_e8s) - billions_check) < 1e15);