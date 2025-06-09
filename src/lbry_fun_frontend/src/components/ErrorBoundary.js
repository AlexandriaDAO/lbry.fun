import React, { Component } from "react";
import ErrorFallback from "./ErrorFallback";
class ErrorBoundary extends Component {
    constructor() {
        super(...arguments);
        this.state = {
            error: null,
        };
    }
    static getDerivedStateFromError(error) {
        return { error: error };
    }
    componentDidCatch(error) {
        console.log('error', error);
        this.setState({ error: error });
        // console.error("Uncaught error:", error, errorInfo);
    }
    render() {
        if (this.state.error) {
            return React.createElement(ErrorFallback, { error: this.state.error });
        }
        return this.props.children;
    }
}
export default ErrorBoundary;
