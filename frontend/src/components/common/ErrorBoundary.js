import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    render() {
        if (this.state.hasError) {
            return (_jsxs("div", { className: "p-8 bg-red-900 border border-red-500 rounded", children: [_jsx("h2", { className: "text-red-200 font-bold mb-2", children: "Something went wrong" }), _jsx("p", { className: "text-red-300 text-sm", children: this.state.error?.message })] }));
        }
        return this.props.children;
    }
}
