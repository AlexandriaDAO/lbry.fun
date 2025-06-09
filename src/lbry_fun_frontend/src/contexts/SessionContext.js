import { createContext } from 'react';
const SessionContext = createContext({
    meiliClient: undefined,
    meiliIndex: undefined,
});
export default SessionContext;
