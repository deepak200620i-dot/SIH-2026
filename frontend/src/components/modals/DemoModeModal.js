import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { Play, Square } from "lucide-react";
export const DemoModeModal = ({ isActive, onToggle }) => {
    return (_jsx("button", { onClick: onToggle, className: `fixed bottom-6 left-6 px-4 py-3 rounded font-semibold text-sm transition flex items-center gap-2 ${isActive
            ? "bg-purple-600 hover:bg-purple-700 text-white"
            : "bg-gray-800 hover:bg-gray-700 text-gray-300"}`, children: isActive ? (_jsxs(_Fragment, { children: [_jsx(Square, { size: 16 }), " Stop Demo"] })) : (_jsxs(_Fragment, { children: [_jsx(Play, { size: 16 }), " Start Demo"] })) }));
};
