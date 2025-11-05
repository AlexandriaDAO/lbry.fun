import { useInternetIdentity } from 'ic-use-internet-identity';
import { getCurrentIdentity } from '@/features/auth/utils/authUtils';

// Export getIdentity for use in interceptors and other non-React code
export const getIdentity = getCurrentIdentity;

export function useIdentity() {
    // Always use Internet Identity
    return useInternetIdentity();
}
