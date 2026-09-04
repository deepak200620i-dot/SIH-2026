import { jsx as _jsx } from "react/jsx-runtime";
import { SEVERITY_COLORS } from "@/utils/constants";
export const SeverityBadge = ({ severity }) => {
    const colors = SEVERITY_COLORS[severity];
    return (_jsx("div", { className: `inline-block px-2 py-1 rounded text-xs font-bold ${colors.badge} text-white`, children: severity }));
};
