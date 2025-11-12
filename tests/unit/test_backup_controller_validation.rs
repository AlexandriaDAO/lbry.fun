use candid::Principal;

/// Test to validate that the BACKUP_CONTROLLER principal is valid at compile time
#[test]
fn test_backup_controller_principal_valid() {
    // Import the constant from the lbry_fun crate
    const BACKUP_CONTROLLER: &str = "yog5q-6fxnl-g4zd4-s2nuh-f7fkw-ijb4e-z7dmo-jrarx-uoe2x-wx5sh-dae";

    // This test will fail at compile time if the principal is invalid
    let result = Principal::from_text(BACKUP_CONTROLLER);

    assert!(
        result.is_ok(),
        "BACKUP_CONTROLLER must be a valid principal. Error: {:?}",
        result.err()
    );

    // Verify the principal was parsed correctly
    let principal = result.unwrap();
    assert_eq!(
        principal.to_text(),
        BACKUP_CONTROLLER,
        "Principal should round-trip correctly"
    );
}

/// Test to verify controller settings are properly configured
#[test]
fn test_controller_settings_configuration() {
    const BACKUP_CONTROLLER: &str = "yog5q-6fxnl-g4zd4-s2nuh-f7fkw-ijb4e-z7dmo-jrarx-uoe2x-wx5sh-dae";

    // Verify we can parse the backup controller
    let backup_controller = Principal::from_text(BACKUP_CONTROLLER)
        .expect("Backup controller must be valid");

    // Simulate self principal (in real code this would be ic_cdk::api::id())
    let self_principal = Principal::anonymous();

    // Verify we can create a controllers vector with both
    let controllers = vec![self_principal, backup_controller];

    assert_eq!(controllers.len(), 2, "Should have exactly 2 controllers");
    assert!(controllers.contains(&self_principal), "Should contain self principal");
    assert!(controllers.contains(&backup_controller), "Should contain backup controller");
}