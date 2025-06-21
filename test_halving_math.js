// Test halving math

const E8S = 100_000_000;

// The halving_step from frontend is 70000 * E8S = 7000000000000
const halving_step_e8s = 7_000_000_000_000;

// But in the schedule generation, it expects a percentage (70)
// So we need to convert: 70000 * E8S -> 70
const halving_percentage = halving_step_e8s / (E8S * 1000);

console.log("Frontend sends halving_step:", halving_step_e8s);
console.log("This represents:", halving_step_e8s / E8S, "tokens");
console.log("But schedule expects percentage:", halving_percentage);

// Test the math
let primary_per_threshold = 2000 * E8S;
console.log("\nStarting primary_per_threshold:", primary_per_threshold / E8S);

// Wrong way (what's happening now)
let wrong_next = (primary_per_threshold * halving_step_e8s) / 100;
console.log("Wrong calculation:", wrong_next / E8S);

// Right way
let right_next = (primary_per_threshold * 70) / 100;
console.log("Right calculation:", right_next / E8S);

console.log("\nThe issue: halving_step is in E8S but the formula expects a percentage!");