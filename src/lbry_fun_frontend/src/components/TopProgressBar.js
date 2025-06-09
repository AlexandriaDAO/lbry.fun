import React, { useEffect } from "react";
import NProgress from "nprogress";
const TopProgressBar = () => {
    useEffect(() => {
        NProgress.start();
        return () => {
            NProgress.done();
        };
    }, []);
    return React.createElement("div", { className: "w-full h-20 flex justify-center items-center" }, "Loading...");
};
export default TopProgressBar;
