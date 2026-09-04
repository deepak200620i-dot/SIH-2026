import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet } from "react-router-dom";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
export const AppShell = ({ pageTitle, isDemoMode = false, alertCount = 0 }) => {
    return (_jsxs("div", { className: "flex h-screen bg-gray-950", children: [_jsx(Sidebar, {}), _jsxs("div", { className: "flex-1 flex flex-col", children: [_jsx(TopBar, { title: pageTitle, isDemoMode: isDemoMode, alertCount: alertCount }), _jsx("div", { className: "flex-1 overflow-auto", children: _jsx(Outlet, {}) })] })] }));
};
