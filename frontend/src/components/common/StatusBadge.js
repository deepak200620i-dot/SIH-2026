import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CAMERA_STATUS_COLORS } from "@/utils/constants";
export const StatusBadge = ({ status, text }) => {
    const colorClass = CAMERA_STATUS_COLORS[status];
    return (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: `w-2 h-2 rounded-full ${colorClass}` }), _jsx("span", { className: "text-xs font-medium", children: text || status })] }));
};
