import React, { useEffect, useState } from "react";
import ReduxProvider from "./providers/ReduxProvider";

import "./styles/tailwind.css";
// import SessionProvider from "./providers/SessionProvider";

import "./styles/style.css";

import "nprogress/nprogress.css";

import InternetIdentityProvider from "./providers/AuthProvider/IIProvider";
// import ActorProvider from "./providers/ActorProvider";
// import UserProvider from "./providers/UserProvider";
import { AppRoutes } from "./routes";

export default function App() {
    const [isReady, setIsReady] = useState(false);

    // costs a re render
    // Mark the app as ready after a short delay to ensure all providers are initialized
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsReady(true);
            console.log("App is ready");
        }, 100);
        
        return () => clearTimeout(timer);
    }, []);

    return (
        <ReduxProvider>
            <InternetIdentityProvider>
                {/* <UserProvider> Removed </UserProvider> */}
                {isReady ? <AppRoutes /> : null}
            </InternetIdentityProvider>
        </ReduxProvider>
    )
}