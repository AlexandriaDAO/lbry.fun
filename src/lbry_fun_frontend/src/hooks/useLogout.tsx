import { useIdentity } from './useIdentity';
import { useNavigate } from "react-router";
import { clearAuthCaches } from '@/features/auth/utils/authUtils';

export function useLogout() {
    const {clear} = useIdentity();
    const navigate = useNavigate()

    const logout = async ()=>{
        await clear();
        clearAuthCaches(); // Clear all cached actors and agents
        
        navigate('/')
    }

    return logout
}