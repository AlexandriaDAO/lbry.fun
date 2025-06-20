/// Test to verify the tokenomics bug fix
use lbry_fun::simulation::{preview_tokenomics_graphs, PresetTokenomics};

#[test]
fn test_tokenomics_fix_verification() {
    println!("\n=== Verifying Tokenomics Fix ===");
    
    // Test Quick Launch preset
    let quick_launch = PresetTokenomics::QuickLaunch;
    let graph_data = preview_tokenomics_graphs(quick_launch);
    
    // Calculate total minted from cumulative data
    let total_minted = graph_data.total_tokens_data_y.last()
        .expect("Should have minting data");
    
    println!("Quick Launch Results:");
    println!("- Total epochs: {}", graph_data.total_tokens_data_x.len());
    println!("- Total minted: {} tokens", total_minted);
    println!("- Max supply: 1,000,000 tokens");
    println!("- Overminting: {}%", 
        (((*total_minted as f64) / 1_000_000.0) - 1.0) * 100.0);
    
    // Verify no overminting
    assert!(
        *total_minted <= 1_000_000,
        "Quick Launch: Total minted {} should not exceed 1,000,000",
        total_minted
    );
    
    // Test Extended Distribution preset
    let extended = PresetTokenomics::ExtendedDistribution;
    let graph_data = preview_tokenomics_graphs(extended);
    
    let total_minted = graph_data.total_tokens_data_y.last()
        .expect("Should have minting data");
    
    println!("\nExtended Distribution Results:");
    println!("- Total epochs: {}", graph_data.total_tokens_data_x.len());
    println!("- Total minted: {} tokens", total_minted);
    println!("- Max supply: 1,000,000 tokens");
    
    // Verify no overminting
    assert!(
        *total_minted <= 1_000_000,
        "Extended Distribution: Total minted {} should not exceed 1,000,000",
        total_minted
    );
    
    // Verify we have 15+ epochs as advertised
    assert!(
        graph_data.total_tokens_data_x.len() >= 15,
        "Extended Distribution should have 15+ epochs, got {}",
        graph_data.total_tokens_data_x.len()
    );
    
    println!("\n✅ Fix verified: No overminting detected!");
}