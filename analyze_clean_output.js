// Analyze the clean implementation output

const E8S = 100_000_000;

// From the output
const epochs = {
    1: 20_000_000_000_000n,
    2: 40_000_000_000_000n,
    3: 39_990_000_000_000n
};

const totalSupply = 100_000_000_000_000n;
const tge = 10_000_000_000n;

console.log("Clean Implementation Results:");
console.log("============================");

console.log("\nTGE:");
console.log(`- E8S: ${tge}`);
console.log(`- Natural: ${Number(tge) / E8S}`);
console.log(`- Percentage: ${(Number(tge) / Number(totalSupply) * 100).toFixed(2)}%`);

let cumulative = tge;
for (const [num, minted] of Object.entries(epochs)) {
    cumulative += minted;
    const natural = Number(minted) / E8S;
    const cumulativeNatural = Number(cumulative) / E8S;
    const percentage = (Number(cumulative) / Number(totalSupply) * 100).toFixed(2);
    
    console.log(`\nEpoch ${num}:`);
    console.log(`- Minted: ${natural.toLocaleString()} tokens`);
    console.log(`- Cumulative: ${cumulativeNatural.toLocaleString()} tokens`);
    console.log(`- Percentage: ${percentage}%`);
}

console.log("\nSummary:");
console.log("- Total epochs: 3 (plus TGE)");
console.log("- Total minted:", Number(cumulative) / E8S, "tokens");
console.log("- Supply utilization:", (Number(cumulative) / Number(totalSupply) * 100).toFixed(2) + "%");

console.log("\nIssues:");
console.log("1. Only 3 epochs instead of 4");
console.log("2. Epochs mint 200k, 400k, 399.9k instead of expected 200k, 280k, 392k, 128k");
console.log("3. TGE is 100 tokens (correct)");