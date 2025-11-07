#!/usr/bin/env python3
"""
Analyze the distribution data from mainnet to identify the exact cause of the 0.14 ICP discrepancy.
"""

# Actual mainnet distribution data
distributions = [
    {"pool": 12805, "alex": 1, "stakers": 127},
    {"pool": 12934, "alex": 1, "stakers": 128},
    {"pool": 13064, "alex": 1, "stakers": 129},
    {"pool": 13195, "alex": 1, "stakers": 130},
    {"pool": 13328, "alex": 1, "stakers": 132},
    {"pool": 13462, "alex": 1, "stakers": 133},
    {"pool": 13597, "alex": 1, "stakers": 134},
    {"pool": 13734, "alex": 1, "stakers": 136},
    {"pool": 13872, "alex": 1, "stakers": 137},
    {"pool": 14012, "alex": 1, "stakers": 139},
]

print("=" * 80)
print("DISTRIBUTION ANALYSIS - MAINNET DATA")
print("=" * 80)
print()

total_alex_actual = 0
total_alex_expected = 0
total_stakers_actual = 0
total_stakers_expected = 0
total_distributed_actual = 0
total_distributed_expected = 0

print("Distribution #  | Pool E8S | Dist(1%) | ALEX Actual | ALEX Expected | Loss")
print("-" * 80)

for i, dist in enumerate(distributions, 1):
    pool = dist["pool"]
    alex_actual = dist["alex"]
    stakers_actual = dist["stakers"]

    # Calculate what SHOULD have been distributed
    total_distribution = pool // 100  # 1% of pool (integer division)

    # Calculate what ALEX SHOULD have gotten (1% of distribution)
    alex_expected_exact = total_distribution * 0.01  # Exact value with decimals
    alex_expected_int = total_distribution // 100    # Integer division result

    # Track totals
    total_alex_actual += alex_actual
    total_alex_expected += alex_expected_exact
    total_stakers_actual += stakers_actual
    total_stakers_expected += (total_distribution - alex_expected_exact)
    total_distributed_actual += (alex_actual + stakers_actual)
    total_distributed_expected += total_distribution

    # Calculate loss
    alex_loss = alex_expected_exact - alex_actual

    print(f"Distribution {i:2} | {pool:8} | {total_distribution:8} | {alex_actual:11} | {alex_expected_exact:13.2f} | {alex_loss:5.2f}")

print("-" * 80)
print()

print("CUMULATIVE ANALYSIS:")
print("=" * 40)
print(f"Total Distributions: {len(distributions)}")
print()

print("ALEX (Platform Fee):")
print(f"  Actual received:    {total_alex_actual} E8S")
print(f"  Expected (1%):      {total_alex_expected:.2f} E8S")
print(f"  Shortfall:          {total_alex_expected - total_alex_actual:.2f} E8S")
print(f"  Percentage actual:  {(total_alex_actual / total_distributed_actual) * 100:.3f}%")
print(f"  Percentage expected: 1.000%")
print()

print("STAKERS:")
print(f"  Actual received:    {total_stakers_actual} E8S")
print(f"  Expected (99%):     {total_stakers_expected:.2f} E8S")
print(f"  Overage:            {total_stakers_actual - total_stakers_expected:.2f} E8S")
print(f"  Percentage actual:  {(total_stakers_actual / total_distributed_actual) * 100:.3f}%")
print(f"  Percentage expected: 99.000%")
print()

print("TOTAL DISTRIBUTED:")
print(f"  Actual:             {total_distributed_actual} E8S")
print(f"  Expected:           {total_distributed_expected} E8S")
print(f"  Difference:         {total_distributed_actual - total_distributed_expected} E8S")
print()

# Now let's see if this explains the 0.14 ICP discrepancy
print("=" * 80)
print("DISCREPANCY EXPLANATION:")
print("=" * 80)
print()

# The discrepancy is 14,084,798 E8S
actual_discrepancy = 14_084_798

print(f"Observed mainnet discrepancy: {actual_discrepancy:,} E8S (0.14 ICP)")
print(f"ALEX shortfall (10 distributions): {total_alex_expected - total_alex_actual:.0f} E8S")
print()

# Extrapolate to explain full discrepancy
if total_alex_expected > total_alex_actual:
    per_dist_loss = (total_alex_expected - total_alex_actual) / len(distributions)
    estimated_distributions_needed = actual_discrepancy / per_dist_loss
    print(f"Average loss per distribution: {per_dist_loss:.2f} E8S")
    print(f"Distributions needed to accumulate 0.14 ICP: {estimated_distributions_needed:.0f}")
    print()

    # With 1.5 hour intervals (5,398 seconds)
    hours_of_operation = estimated_distributions_needed * 1.5
    days_of_operation = hours_of_operation / 24
    print(f"At 1.5 hour intervals, this would take:")
    print(f"  {hours_of_operation:.0f} hours")
    print(f"  {days_of_operation:.1f} days")
    print()

# Check if the rounding pattern is consistent
print("ROUNDING PATTERN ANALYSIS:")
print("=" * 40)
print("Does ALEX always get exactly 1 E8S? ", "YES" if all(d["alex"] == 1 for d in distributions) else "NO")

# Calculate the integer division pattern
print("\nInteger Division Analysis:")
for dist in distributions[:3]:  # Show first 3 as examples
    pool = dist["pool"]
    total_dist = pool // 100
    alex_by_division = total_dist // 100
    print(f"  Pool {pool} → {total_dist} distribution → {alex_by_division} to ALEX (via // 100)")

print()
print("CONCLUSION:")
print("=" * 80)
print("The discrepancy is NOT primarily from distribution rounding!")
print()
print(f"- 10 distributions only account for ~{total_alex_expected - total_alex_actual:.0f} E8S loss")
print(f"- Actual discrepancy is {actual_discrepancy:,} E8S")
print(f"- Would need ~{estimated_distributions_needed:.0f} distributions to accumulate 0.14 ICP")
print(f"- That's ~{days_of_operation:.0f} days at 1.5 hour intervals")
print()
print("This suggests the 0.14 ICP discrepancy has ANOTHER source beyond distribution math.")