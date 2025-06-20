// Verify the Quick Launch calculation

const burnUnit = 1_000_000;  // 1M tokens
const rewardRate = 2000;     // 2000 per burn unit
const E8S = 100_000_000;     // 10^8

console.log('Quick Launch First Epoch Calculation:');
console.log('=====================================');
console.log(`Burn unit: ${burnUnit.toLocaleString()} tokens`);
console.log(`Reward rate: ${rewardRate} per burn unit`);
console.log(`E8S constant: ${E8S.toLocaleString()}`);

// The calculation from simulation.rs
const rewardE8s = rewardRate * burnUnit * 10000;
console.log(`\nStep 1: reward_e8s = ${rewardRate} * ${burnUnit.toLocaleString()} * 10000`);
console.log(`       reward_e8s = ${rewardE8s.toLocaleString()}`);

const rewardTokens = Math.floor(rewardE8s / E8S);
console.log(`\nStep 2: reward_tokens = ${rewardE8s.toLocaleString()} / ${E8S.toLocaleString()}`);
console.log(`       reward_tokens = ${rewardTokens.toLocaleString()}`);

console.log(`\nResult: First epoch mints ${rewardTokens.toLocaleString()} tokens`);
console.log(`For a token with max supply of 1,000,000, this is ${(rewardTokens / 1_000_000 * 100).toFixed(1)}% of total supply`);

// What the correct calculation might be
console.log('\n\nAlternative interpretations:');
console.log('-----------------------------');

// If reward_rate means tokens per secondary burned
const alt1 = rewardRate * burnUnit;
console.log(`1. If reward_rate = tokens per secondary: ${rewardRate} * ${burnUnit.toLocaleString()} = ${alt1.toLocaleString()} tokens`);

// If the 10000 is meant to be a divisor
const alt2 = (rewardRate * burnUnit) / 10000;
console.log(`2. If 10000 is a divisor: (${rewardRate} * ${burnUnit.toLocaleString()}) / 10000 = ${alt2.toLocaleString()} tokens`);

// What users might expect
console.log(`\n3. What users might expect:`);
console.log(`   - "2000 reward rate" → 2000 tokens minted per epoch`);
console.log(`   - Or maybe 2000 tokens total for burning the whole unit`);

console.log('\n\nThe actual formula explanation:');
console.log('-------------------------------');
console.log('reward_e8s = reward_rate * burn_amount * 10000');
console.log('');
console.log('This seems to be treating:');
console.log('- reward_rate as a rate per burn unit');
console.log('- Multiplying by burn_amount (which is already the burn unit)');
console.log('- Then multiplying by 10000 (unclear why)');
console.log('- Then dividing by E8S to get tokens');
console.log('');
console.log('The 10000 multiplier makes the result 100x larger than expected!');