import React from "react";
import { Provider } from "react-redux";
import { store } from "@/store"; // Import the store
const ReduxProvider = ({ children }) => {
    return React.createElement(Provider, { store: store }, children);
};
export default ReduxProvider;
