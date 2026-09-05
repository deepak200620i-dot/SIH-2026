import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Database, Server, ShieldCheck, Wifi } from "lucide-react";
import { apiGetSystemStatus } from "@/services/api";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
export const Settings = () => {
    const [status, setStatus] = useState(null);
    useEffect(() => { apiGetSystemStatus().then(setStatus); }, []);
    if (!status)
        return _jsx(LoadingSpinner, {});
    const services = [["API Server", status.apiServer, Server], ["Database", status.database, Database], ["AI Engine", status.aiEngine, ShieldCheck], ["Event stream", status.websocket, Wifi]];
    return _jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold", children: "System Settings" }), _jsx("p", { className: "text-sm text-gray-500", children: "Live health of the local IBVAP services." })] }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: services.map(([label, value, Icon]) => _jsxs("div", { className: "panel p-5 flex gap-4 items-center", children: [_jsx("div", { className: "rounded-full bg-maroon-50 p-3 text-maroon-800", children: _jsx(Icon, { size: 22 }) }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-500", children: label }), _jsx("p", { className: "font-semibold", children: value })] })] }, label)) }), _jsxs("div", { className: "panel p-5", children: [_jsx("h2", { className: "font-semibold", children: "Deployment note" }), _jsx("p", { className: "mt-2 text-sm text-gray-600", children: "This build stores event data in the configured local SQLite database. Configure external infrastructure before using it for persistent multi-user operations." })] })] });
};
