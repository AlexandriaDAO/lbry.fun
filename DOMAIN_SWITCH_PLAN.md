# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/lbryfun" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/lbryfun-domain-switch"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/lbryfun-domain-switch`
2. **Implement feature** - Follow plan sections below
3. **Build locally** (verification only - NEVER DEPLOY TO MAINNET):
   ```bash
   ./scripts/build.sh
   ```
   **⚠️ PRODUCTION WARNING**: This is a live financial application. Never deploy to mainnet.
4. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "Switch domain from lbry.fun to caffeinelauncher.com"
   git push -u origin feature/switch-to-caffeinelauncher
   gh pr create --title "[Config]: Switch domain to caffeinelauncher.com" --body "Implements DOMAIN_SWITCH_PLAN.md - Updates all domain references from lbry.fun to caffeinelauncher.com for IC boundary node registration"
   ```
5. **Iterate autonomously**:
   - FOR i=1 to 5:
     - Check review: `gh pr view [NUM] --json comments`
     - Count P0 issues
     - IF P0 > 0: Fix immediately, commit, push, sleep 300s, continue
     - IF P0 = 0: Report success, EXIT
   - After 5 iterations: Escalate to human

## CRITICAL RULES
- ❌ NO questions ("should I?", "want me to?", "is it done?")
- ❌ NO skipping PR creation - it's MANDATORY
- ❌ NO stopping after implementation - create PR immediately
- ✅ After sleep: IMMEDIATELY continue (no pause)
- ✅ ONLY stop at: approved, max iterations, or error

**Branch:** `feature/switch-to-caffeinelauncher`
**Worktree:** `/home/theseus/alexandria/lbryfun-domain-switch`

---

# Implementation Plan: Domain Switch to caffeinelauncher.com

## Task Classification
**CONFIGURATION CHANGE**: Update domain references and prepare for boundary node registration → targeted fixes

## Current State

### Domain References Found
1. **`src/lbry_fun_frontend/public/.well-known/ic-domains`** (line 1-2)
   - Contains: `lbry.fun` and `www.lbry.fun`
   - Purpose: IC boundary node domain verification

2. **`src/lbry_fun_frontend/public/.well-known/ii-alternative-origins`** (line 2)
   - Contains: `https://lbry.app` in alternativeOrigins array
   - Purpose: Internet Identity authentication origins
   - Note: lbry.app appears to be related but separate domain

3. **`validation/VALIDATION_GUIDE.md`** (line 4)
   - Contains: Reference to "lbry.fun" in documentation
   - Purpose: User-facing documentation

4. **`src/lbry_fun_frontend/public/.ic-assets.json`**
   - Configures `.well-known` directory to be served with proper headers
   - No changes needed (structure remains same)

### Files That DON'T Need Changes
- `webpack.config.js` - Only contains IC infrastructure URLs (localhost, ic0.app)
- `src/lbry_fun_frontend/src/features/auth/utils/authUtils.ts` - Only IC gateway URLs
- `src/lbry_fun_frontend/src/utils/getIcHost.ts` - Only IC gateway URLs
- `dfx.json` - Canister configuration only
- No environment variables found referencing lbry.fun

## Implementation Steps

### Step 1: Update IC Domains File (MODIFY)
**File:** `src/lbry_fun_frontend/public/.well-known/ic-domains`

**Current Content:**
```
lbry.fun
www.lbry.fun
```

**New Content:**
```
caffeinelauncher.com
www.caffeinelauncher.com
```

**Reasoning:** This file is read by IC boundary nodes to verify domain ownership. Must match the domain being registered.

### Step 2: Evaluate II Alternative Origins (RESEARCH FIRST)
**File:** `src/lbry_fun_frontend/public/.well-known/ii-alternative-origins`

**Current Content:**
```json
{
  "alternativeOrigins": ["https://lbry.app", "https://yj5ba-aiaaa-aaaap-qkmoa-cai.icp0.io", "http://localhost:8080", "http://localhost:3000", "http://yj5ba-aiaaa-aaaap-qkmoa-cai.localhost:4943"]
}
```

**Analysis Needed:**
- Does `lbry.app` need to be updated to `caffeinelauncher.com`?
- Or is `lbry.app` a separate domain that should remain?
- Need to understand if this is the same frontend or different

**Decision Logic:**
```
IF lbry.app == current production domain for this frontend:
  UPDATE to caffeinelauncher.com
ELSE IF lbry.app == legacy/separate domain:
  ADD caffeinelauncher.com to array (keep both)
  OR replace if migrating completely
```

**Recommended Action (for implementer to verify):**
Since we're switching primary domain from lbry.fun → caffeinelauncher.com, and lbry.app appears related:
```json
{
  "alternativeOrigins": [
    "https://caffeinelauncher.com",
    "https://yj5ba-aiaaa-aaaap-qkmoa-cai.icp0.io",
    "http://localhost:8080",
    "http://localhost:3000",
    "http://yj5ba-aiaaa-aaaap-qkmoa-cai.localhost:4943"
  ]
}
```

**⚠️ IMPLEMENTER: Verify with user if lbry.app should be preserved in array**

### Step 3: Update Documentation (MODIFY)
**File:** `validation/VALIDATION_GUIDE.md`

**Change:** Line 4
```markdown
# OLD
This guide explains how to validate tokenomics for **any** token launch on lbry.fun.

# NEW
This guide explains how to validate tokenomics for **any** token launch on caffeinelauncher.com.
```

**Additional Check:** Search entire file for other references
```bash
grep -n "lbry\.fun" validation/VALIDATION_GUIDE.md
```
Update any other occurrences found.

### Step 4: Build and Test Locally
```bash
# Verify changes compile
./scripts/build.sh

# Expected: Clean build with no errors
# The .well-known files will be copied to dist/lbry_fun_frontend/
```

**Verification:**
```bash
# Check that files are copied correctly
cat dist/lbry_fun_frontend/.well-known/ic-domains
# Should show: caffeinelauncher.com and www.caffeinelauncher.com

cat dist/lbry_fun_frontend/.well-known/ii-alternative-origins
# Should show updated JSON with caffeinelauncher.com
```

## Post-PR Manual Steps (Document in PR Description)

After PR is merged and changes are deployed to mainnet, the following manual steps are required:

### Step 5: Register Domain with IC Boundary Nodes
**⚠️ This cannot be automated - requires manual execution after deployment**

```bash
# Register primary domain
curl -sLv -X POST \
  -H 'Content-Type: application/json' \
  https://icp0.io/registrations \
  --data @- <<EOF
{
  "name": "caffeinelauncher.com"
}
EOF

# Register www subdomain
curl -sLv -X POST \
  -H 'Content-Type: application/json' \
  https://icp0.io/registrations \
  --data @- <<EOF
{
  "name": "www.caffeinelauncher.com"
}
EOF
```

**Expected Response:** 200 OK
**Time to Propagate:** Usually 5-15 minutes for SSL certificates to be issued

### Step 6: Verify Domain Registration
```bash
# Check domain works
curl -I https://caffeinelauncher.com

# Should return:
# - HTTP/2 200 OK
# - Valid SSL certificate from Let's Encrypt (via IC boundary nodes)
# - No certificate errors

# Test in browser
# Navigate to: https://caffeinelauncher.com
# - Should load frontend without SSL warnings
# - Should be able to authenticate with Internet Identity
```

### Step 7: DNS Verification Checklist
User mentioned DNS records are already configured. Verify:

```bash
# Check DNS records are correct
dig caffeinelauncher.com
dig www.caffeinelauncher.com

# Expected records (CNAME or ALIAS/ANAME):
# caffeinelauncher.com.     → icp1.io (or ALIAS/ANAME)
# www.caffeinelauncher.com. → icp1.io (CNAME)
```

**⚠️ Important DNS Notes:**
1. **Disable Cloudflare Universal SSL** if using Cloudflare (interferes with IC certificates)
2. **CNAME Flattening**: If DNS provider doesn't support CNAME at apex, use ALIAS or ANAME records
3. **TTL**: Set to 300 (5 min) during migration for quick rollback if needed

## Testing Requirements

### Local Build Verification
```bash
./scripts/build.sh
```
- **NEVER deploy to mainnet** - this is a production app with financial consequences
- Only verify compilation succeeds
- Check that `.well-known` files are copied to dist correctly

### Manual Testing After Deployment
1. **DNS Resolution**: Verify domain points to IC boundary nodes
2. **SSL Certificate**: Verify HTTPS works without warnings
3. **Internet Identity**: Test authentication flow works on new domain
4. **Asset Loading**: Verify all assets (JS, CSS, images) load correctly
5. **Canister Communication**: Verify frontend can communicate with backend canisters

## Rollback Plan

If domain switch causes issues:

### Immediate Rollback (Code)
```bash
# Revert domain files
git revert <commit-hash>
git push

# Re-deploy frontend
./scripts/network_deploy_frontend.sh
```

### DNS Rollback
```bash
# Point domain back to old infrastructure
# Update DNS records to previous values
# Wait for TTL to expire (5-15 minutes with 300s TTL)
```

### Boundary Node Cleanup
```bash
# Old domain (lbry.fun) registration remains valid
# Can re-register if needed using same curl command

# If need to remove caffeinelauncher.com:
# Currently no public API for deletion
# Contact DFINITY support on forum.dfinity.org
```

## Success Criteria

- [ ] `.well-known/ic-domains` contains caffeinelauncher.com domains
- [ ] `.well-known/ii-alternative-origins` updated appropriately
- [ ] Documentation updated
- [ ] Local build succeeds
- [ ] PR created and approved
- [ ] Changes deployed to mainnet (manual step)
- [ ] Domain registered with boundary nodes (manual step)
- [ ] HTTPS works on caffeinelauncher.com
- [ ] Internet Identity authentication works
- [ ] No SSL certificate errors

## Notes for Implementer

1. **II Alternative Origins Decision**: Line 2 update requires verification. If unsure, ask user in PR description whether `lbry.app` should be preserved.

2. **No Backend Changes**: This is purely a frontend configuration change. No Rust code modifications needed.

3. **No Environment Variables**: No `.env` file changes needed since domain is not stored there.

4. **Deployment Timing**: Code changes can be merged anytime, but boundary node registration must happen AFTER deployment to mainnet for verification to work.

5. **Certificate Issuance**: Boundary nodes use Let's Encrypt. First issuance takes 5-15 min. Renewals are automatic.

## References

- IC Custom Domains Docs: https://internetcomputer.org/docs/current/developer-docs/web-apps/custom-domains/using-custom-domains
- Boundary Node Registration: https://icp0.io/registrations
- Forum Discussions: https://forum.dfinity.org (search "custom domain")

---

## Summary

This is a straightforward configuration change affecting 2-3 files. The code changes are minimal and low-risk. The critical steps (boundary node registration, DNS verification) are manual and must happen after deployment.

**Total Modified Files:** 2-3
**Total New Files:** 0
**Total Deleted Files:** 0
**Risk Level:** Low (configuration only)
**Deployment:** Requires manual boundary node registration post-merge
