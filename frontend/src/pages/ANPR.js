import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { apiGetANPREvents } from "@/services/api";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
export const ANPR = () => {
    const [anprEvents, setAnprEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    useEffect(() => {
        const loadANPREvents = async () => {
            try {
                setLoading(true);
                const data = await apiGetANPREvents(page, 12);
                setAnprEvents(data.items);
            }
            catch (error) {
                console.error("Failed to load ANPR events:", error);
            }
            finally {
                setLoading(false);
            }
        };
        loadANPREvents();
    }, [page]);
    if (loading) {
        return _jsx(LoadingSpinner, {});
    }
    const unknownCount = anprEvents.filter((e) => e.status === "UNKNOWN").length;
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h1", { className: "text-white text-2xl font-bold", children: "Vehicle Plate Recognition (ANPR)" }), _jsxs("div", { className: "text-right", children: [_jsx("p", { className: "text-gray-400 text-sm", children: "Unknown Vehicles" }), _jsx("p", { className: "text-yellow-400 text-2xl font-bold", children: unknownCount })] })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", children: anprEvents.map((event) => (_jsxs("div", { className: "border border-gray-700 rounded overflow-hidden hover:border-blue-500 transition", children: [_jsx("div", { className: "bg-gray-800 h-32 flex items-center justify-center", children: _jsx("img", { src: event.vehicleImageUrl, alt: "Vehicle", className: "w-full h-full object-cover" }) }), _jsxs("div", { className: "bg-gray-900 p-4 space-y-3 border-t border-gray-700", children: [_jsx("div", { className: "bg-yellow-900 border border-yellow-500 p-2 rounded text-center", children: _jsx("p", { className: "text-yellow-200 font-bold text-lg font-mono", children: event.plateNumber }) }), _jsxs("div", { className: "grid grid-cols-2 gap-2 text-xs", children: [_jsxs("div", { children: [_jsx("p", { className: "text-gray-400 mb-1", children: "OCR Confidence" }), _jsxs("p", { className: "text-white font-semibold", children: [event.ocrConfidence, "%"] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-gray-400 mb-1", children: "Status" }), _jsx("p", { className: `font-semibold ${event.status === "UNKNOWN"
                                                        ? "text-yellow-400"
                                                        : event.status === "AUTHORIZED"
                                                            ? "text-green-400"
                                                            : "text-red-400"}`, children: event.status })] })] }), _jsx("p", { className: "text-gray-400 text-xs", children: event.cameraId })] })] }, event.id))) }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("button", { disabled: page === 1, onClick: () => setPage(page - 1), className: "px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white rounded transition", children: "Previous" }), _jsxs("span", { className: "text-gray-400", children: ["Page ", page] }), _jsx("button", { onClick: () => setPage(page + 1), className: "px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded transition", children: "Next" })] })] }));
};
