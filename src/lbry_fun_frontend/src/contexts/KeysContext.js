// contexts/KeysContext.tsx
import React, { createContext, useContext, useState } from 'react';
const KeysContext = createContext({
    Keys: null,
    setKeys: () => { },
});
export const useKeys = () => useContext(KeysContext);
export const KeysProvider = ({ children }) => {
    const [Keys, setKeys] = useState(null);
    return (React.createElement(KeysContext.Provider, { value: { Keys, setKeys } }, children));
};
