import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Shield } from "lucide-react";
export const Login = ({ onLogin }) => {
    const [username, setUsername] = useState("operator");
    const [password, setPassword] = useState("");
    const handleLogin = (e) => {
        e.preventDefault();
        onLogin();
    };
    return (_jsx("div", { className: "min-h-screen bg-gray-950 flex items-center justify-center", children: _jsxs("div", { className: "max-w-md w-full", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsxs("div", { className: "flex items-center justify-center gap-3 mb-4", children: [_jsx(Shield, { size: 32, className: "text-blue-500" }), _jsx("h1", { className: "text-3xl font-bold text-white", children: "IBVAP" })] }), _jsx("p", { className: "text-gray-400 text-sm", children: "Intelligent Border Video Analytics" })] }), _jsxs("form", { onSubmit: handleLogin, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-gray-300 text-sm font-medium mb-2", children: "Username" }), _jsx("input", { type: "text", value: username, onChange: (e) => setUsername(e.target.value), className: "w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-gray-300 text-sm font-medium mb-2", children: "Password" }), _jsx("input", { type: "password", value: password, onChange: (e) => setPassword(e.target.value), className: "w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" })] }), _jsx("button", { type: "submit", className: "w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded transition", children: "Login" })] }), _jsxs("div", { className: "mt-6 p-4 bg-blue-900/20 border border-blue-700 rounded text-sm text-blue-200", children: [_jsx("p", { className: "font-semibold mb-1", children: "Demo Credentials" }), _jsx("p", { children: "Username: operator" }), _jsx("p", { children: "Password: (any)" })] })] }) }));
};
