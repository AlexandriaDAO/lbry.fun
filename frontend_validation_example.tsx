// Example React hook for validating frontend calculations against backend
import { useEffect, useState } from 'react';
import { sha256 } from 'js-sha256';

interface TokenomicsSchedule {
    epochs: EpochData[];
    total_epochs: number;
    total_supply_percentage: number;
}

interface ValidationResult {
    isValid: boolean;
    backendChecksum: string;
    frontendChecksum: string;
    differences: any[];
}

// Calculate checksum matching backend logic
function calculateScheduleChecksum(schedule: TokenomicsSchedule): string {
    const hasher = sha256.create();
    
    // Must match backend order exactly
    const totalEpochsBuffer = new ArrayBuffer(4);
    new DataView(totalEpochsBuffer).setUint32(0, schedule.total_epochs, true);
    hasher.update(new Uint8Array(totalEpochsBuffer));
    
    const percentageBuffer = new ArrayBuffer(8);
    new DataView(percentageBuffer).setFloat64(0, schedule.total_supply_percentage, true);
    hasher.update(new Uint8Array(percentageBuffer));
    
    for (const epoch of schedule.epochs) {
        // Add epoch data in same order as backend
        const epochBuffer = new ArrayBuffer(4);
        new DataView(epochBuffer).setUint32(0, epoch.epoch_number, true);
        hasher.update(new Uint8Array(epochBuffer));
        
        // Convert BigInt to buffer for each field
        const fields = [
            epoch.secondary_burned_this_epoch_e8s,
            epoch.primary_minted_this_epoch_e8s,
            epoch.cumulative_secondary_burned_e8s,
            epoch.cumulative_primary_minted_e8s
        ];
        
        for (const value of fields) {
            const buffer = new ArrayBuffer(8);
            new DataView(buffer).setBigUint64(0, BigInt(value), true);
            hasher.update(new Uint8Array(buffer));
        }
    }
    
    return hasher.hex();
}

export function useTokenomicsValidation(
    params: any,
    frontendSchedule: TokenomicsSchedule | null
) {
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
    const [isValidating, setIsValidating] = useState(false);
    
    useEffect(() => {
        if (!frontendSchedule || !params) return;
        
        async function validate() {
            setIsValidating(true);
            try {
                // Option 1: Call validation endpoint
                const response = await canister.validate_tokenomics_calculation({
                    params,
                    frontend_schedule: frontendSchedule
                });
                
                setValidationResult(response);
                
                if (!response.isValid) {
                    console.error('Tokenomics validation failed!', response.differences);
                    // Could show user a warning or log to monitoring
                }
                
                // Option 2: Just get backend calculation and compare locally
                // const backendSchedule = await canister.get_tokenomics_preview(params);
                // const frontendChecksum = calculateScheduleChecksum(frontendSchedule);
                // const backendChecksum = calculateScheduleChecksum(backendSchedule);
                // setValidationResult({
                //     isValid: frontendChecksum === backendChecksum,
                //     frontendChecksum,
                //     backendChecksum,
                //     differences: []
                // });
                
            } catch (error) {
                console.error('Validation error:', error);
            } finally {
                setIsValidating(false);
            }
        }
        
        validate();
    }, [params, frontendSchedule]);
    
    return { validationResult, isValidating };
}

// Usage in component:
function TokenomicsPreview({ params }) {
    const frontendSchedule = calculateTokenomicsSchedule(params);
    const { validationResult, isValidating } = useTokenomicsValidation(params, frontendSchedule);
    
    return (
        <div>
            {/* Show tokenomics preview */}
            {validationResult && !validationResult.isValid && (
                <div className="warning">
                    ⚠️ Frontend/Backend mismatch detected! 
                    Check console for details.
                </div>
            )}
        </div>
    );
}