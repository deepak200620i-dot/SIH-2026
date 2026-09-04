import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { Bell, LogOut, Settings } from "lucide-react";
import { getCurrentDateTime } from "@/utils/date";
export const TopBar = ({ title, alertCount = 0 }) => {
    const [currentTime, setCurrentTime] = useState(getCurrentDateTime());
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(getCurrentDateTime());
        }, 1000);
        return () => clearInterval(interval);
    }, []);
    return (_jsxs("div", { className: "bg-gray-950 border-b border-gray-800 px-6 py-4 flex items-center justify-between", children: [_jsx("div", { className: "flex items-center gap-4", children: _jsxs("div", { children: [_jsx("h1", { className: "text-white font-bold text-lg", children: "IBVAP" }), _jsx("p", { className: "text-gray-400 text-xs", children: "Intelligent Border Video Analytics" })] }) }), title && _jsx("h2", { className: "text-white font-semibold", children: title }), _jsxs("div", { className: "flex items-center gap-6", children: [_jsx("div", { className: "text-right", children: _jsx("p", { className: "text-white font-mono text-sm", children: currentTime }) }), _jsxs("button", { className: "relative p-2 hover:bg-gray-800 rounded transition", children: [_jsx(Bell, { size: 20, className: "text-gray-300" }), alertCount > 0 && (_jsx("span", { className: "absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center", children: alertCount }))] }), _jsx("button", { className: "p-2 hover:bg-gray-800 rounded transition", children: _jsx(Settings, { size: 20, className: "text-gray-300" }) }), _jsx("button", { className: "p-2 hover:bg-gray-800 rounded transition", children: _jsx(LogOut, { size: 20, className: "text-gray-300" }) })] })] }));
};
