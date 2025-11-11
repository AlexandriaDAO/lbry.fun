# Backup Controller Key Management

## Overview
The backup controller provides emergency access to all spawned canisters (5 per token) in case of critical issues or bugs. This document outlines the key management process and security procedures.

## Backup Controller Principal
```
yog5q-6fxnl-g4zd4-s2nuh-f7fkw-ijb4e-z7dmo-jrarx-uoe2x-wx5sh-dae
```

## Key Storage Requirements

### Primary Requirements
- **Cold Storage Only**: The private key for this principal MUST be stored in cold storage
- **Multi-Signature Wallet**: Consider using a hardware wallet with multi-signature capability
- **Geographically Distributed**: Store backup copies in separate physical locations
- **Access Control**: Limit access to a minimum of 2-3 trusted individuals

### Recommended Storage Methods
1. **Hardware Wallet** (Primary)
   - Use a dedicated hardware wallet (Ledger, Trezor, etc.)
   - Never connect to internet except for emergency operations
   - Store in secure physical location (safety deposit box)

2. **Paper Backup** (Secondary)
   - Print seed phrase on archival paper
   - Store in fireproof safe or bank vault
   - Consider splitting seed phrase using Shamir's Secret Sharing

3. **Encrypted Digital Backup** (Tertiary)
   - Encrypt with strong passphrase (separate from seed)
   - Store on offline USB drives in secure locations
   - Use different encryption keys for each copy

## Access Procedures

### When to Use Backup Controller
The backup controller should ONLY be used in these scenarios:
1. **Critical Bug Fix**: When a bug prevents normal canister operation
2. **Stuck Canister**: When a canister becomes unresponsive
3. **Emergency Upgrade**: Security vulnerability requires immediate patch
4. **User Fund Recovery**: When user funds are stuck due to system error

### Access Protocol
1. **Incident Detection**
   - Identify the issue requiring backup controller access
   - Document the problem and proposed solution
   - Get consensus from at least 2 team members

2. **Pre-Access Checklist**
   - [ ] Verify the issue cannot be resolved through normal means
   - [ ] Document the exact operations to be performed
   - [ ] Prepare rollback plan if operation fails
   - [ ] Notify relevant stakeholders

3. **Access Execution**
   - Retrieve backup controller key from cold storage
   - Perform minimum necessary operations
   - Document all actions taken with timestamps
   - Return key to cold storage immediately

4. **Post-Access Requirements**
   - [ ] Create incident report with full details
   - [ ] Review operation logs for any anomalies
   - [ ] Update this document if procedures need improvement
   - [ ] Consider key rotation if security was compromised

## Audit Trail

### Required Documentation
Every use of the backup controller MUST be documented with:
- Date and time of access
- Personnel involved
- Reason for access
- Specific operations performed
- Canisters affected
- Outcome of operations

### Audit Log Location
Maintain audit logs in:
1. Git repository: `/audit/backup_controller_usage.log`
2. Off-chain backup: Secure cloud storage with version control
3. On-chain record: Consider logging major operations to a logging canister

## Key Rotation

### Rotation Schedule
- **Planned Rotation**: Every 12 months
- **Immediate Rotation Required If**:
  - Key compromise suspected
  - Personnel with access leaves organization
  - Security audit recommends rotation

### Rotation Process
1. Generate new backup controller principal
2. Update all existing canisters to add new controller
3. Verify new controller has access
4. Remove old controller from all canisters
5. Update constants.rs with new principal
6. Deploy canister upgrade
7. Securely destroy old key materials

## Security Considerations

### DO NOT
- Store keys on internet-connected devices
- Share keys via digital communication
- Use the backup controller for routine operations
- Grant access without proper authorization
- Keep keys in easily accessible locations

### DO
- Regularly verify key backup integrity
- Test recovery procedures (on testnet)
- Keep access list updated
- Review this document quarterly
- Train authorized personnel on procedures

## Emergency Contacts

### Key Holders
[To be filled in by organization]
- Primary: [Name, Role, Secure Contact]
- Secondary: [Name, Role, Secure Contact]
- Tertiary: [Name, Role, Secure Contact]

### Escalation Path
1. Technical Lead
2. Security Officer
3. Executive Team

## Future Enhancements

### Phase 2 (Post-Launch)
- Implement multi-signature requirement for backup controller
- Add time-locked operations for non-emergency changes
- Create automated monitoring for controller usage

### Phase 3 (Governance)
- Transition to DAO-controlled backup mechanism
- Implement on-chain proposal system for emergency access
- Add automatic key rotation with governance approval

---

**Last Updated**: November 2024
**Version**: 1.0.0
**Status**: Pre-Production

**Note**: This document must be reviewed and approved before mainnet deployment.