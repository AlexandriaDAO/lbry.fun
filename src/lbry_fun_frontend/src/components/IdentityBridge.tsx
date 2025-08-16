import { useEffect, useRef } from 'react';
import { useIdentity } from '@/hooks/useIdentity';
import { registerIdentityGetter, clearAuthCaches } from '@/features/auth/utils/authUtils';

/**
 * Bridge component that connects ic-use-internet-identity to authUtils
 * This allows thunks and other non-React code to access the current identity
 */
export const IdentityBridge: React.FC = () => {
  const { identity } = useIdentity();
  const identityRef = useRef(identity);

  // Always keep the ref updated with the latest identity
  identityRef.current = identity;

  useEffect(() => {
    // Register a function that always returns the current identity from the ref
    console.log('[IdentityBridge] Registering identity getter');
    registerIdentityGetter(() => {
      const currentIdentity = identityRef.current;
      console.log('[IdentityBridge] Getter called, returning identity:', 
        currentIdentity ? currentIdentity.getPrincipal().toString() : 'none');
      return currentIdentity;
    });

    // No cleanup needed - keep the getter registered
  }, []); // Empty deps - only register once

  // Log when identity changes
  useEffect(() => {
    console.log('[IdentityBridge] Identity changed:', 
      identity ? identity.getPrincipal().toString() : 'none');
  }, [identity]);

  return null; // This component doesn't render anything
};