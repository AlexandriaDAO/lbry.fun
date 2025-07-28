#!/bin/bash
# Script to implement 1 ICP fixed cost buffer for deployments

echo "Implementing 1 ICP fixed cost buffer..."

# Backend changes
echo "1. Updating backend refund calculations..."

# Update deployment_cleanup.rs
sed -i 's/deployment\.payment_amount\.saturating_sub(10_000)/deployment.payment_amount.saturating_sub(100_000_000) \/\/ 1 ICP platform fee/g' src/lbry_fun/src/deployment_cleanup.rs

# Update deployment_updates.rs refund message
sed -i 's/(deployment\.payment_amount - 10_000) as f64/(deployment.payment_amount - 100_000_000) as f64/g' src/lbry_fun/src/deployment_updates.rs

# Frontend changes
echo "2. Updating frontend cost display..."

# Update TerminalCreateToken.tsx
sed -i 's/Refundable on failure: 4\.9999 ICP/Refundable on failure: 4.0 ICP/g' src/lbry_fun_frontend/src/features/token/components/terminal/TerminalCreateToken.tsx

# Documentation
echo "3. Updating documentation..."

# Update frontend_recovery_plan_v2.md
sed -i 's/4\.9999 ICP/4.0 ICP/g' frontend_recovery_plan_v2.md

echo "Done! Changes made:"
echo "- Backend now refunds 4 ICP (keeping 1 ICP as platform fee)"
echo "- Frontend shows 'Refundable on failure: 4.0 ICP'"
echo "- Documentation updated"
echo ""
echo "Next steps:"
echo "1. Review the changes with: git diff"
echo "2. Test locally with a deployment that fails"
echo "3. Commit the changes"