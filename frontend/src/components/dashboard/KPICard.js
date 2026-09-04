import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { TrendingUp, TrendingDown } from "lucide-react";
export const KPICard = ({ title, value, icon, trend, subtitle, color = "blue", }) => {
    const colorClasses = {
        red: "border-red-500 bg-red-900/20",
        green: "border-green-500 bg-green-900/20",
        yellow: "border-yellow-500 bg-yellow-900/20",
        blue: "border-blue-500 bg-blue-900/20",
    };
    return (_jsxs("div", { className: `border ${colorClasses[color]} rounded p-4`, children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-gray-400 text-xs font-semibold mb-1", children: title }), _jsx("p", { className: "text-white text-2xl font-bold", children: value }), subtitle && _jsx("p", { className: "text-gray-500 text-xs mt-1", children: subtitle })] }), _jsx("div", { className: "text-gray-500", children: icon })] }), trend && (_jsx("div", { className: "mt-2 flex items-center gap-1 text-xs", children: trend === "up" ? (_jsxs(_Fragment, { children: [_jsx(TrendingUp, { size: 14, className: "text-green-400" }), _jsx("span", { className: "text-green-400", children: "\u2191 12%" })] })) : (_jsxs(_Fragment, { children: [_jsx(TrendingDown, { size: 14, className: "text-red-400" }), _jsx("span", { className: "text-red-400", children: "\u2193 5%" })] })) }))] }));
};
