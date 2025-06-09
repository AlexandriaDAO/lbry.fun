import { useInternetIdentity } from 'ic-use-internet-identity';
// import { useSiweIdentity } from 'ic-use-siwe-identity';
// import { AnonymousIdentity } from '@dfinity/agent'; // Potentially keep for unauthenticated state if needed by useInternetIdentity's types
// import useAuth from '@/hooks/useAuth'; // Removed
// import { useSiwsIdentity } from 'ic-use-siws-identity';
export function useIdentity() {
    // const { provider } = useAuth(); // Removed
    // Always use Internet Identity
    return useInternetIdentity();
    // if (provider === 'II') { // Removed
    //     return useInternetIdentity();
    // }
    // if (provider === 'ETH') { // Removed
    //     return useSiweIdentity();
    // }
    // if (provider === 'SOL') { // Removed
    //     return useSiwsIdentity();
    // }
    // This fallback is no longer needed as we only support II
    // return { // Removed
    //     identity: new AnonymousIdentity(),
    //     clear: () => {},
    //     login: () => {},
    //     isInitializing: false,
    //     isLoggingIn: false
    // };
}
