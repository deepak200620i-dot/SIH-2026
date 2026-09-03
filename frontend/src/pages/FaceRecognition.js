import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { apiGetFaceEvents } from "@/services/api";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { FACE_MATCH_COLORS } from "@/utils/constants";
import { useEffect } from "react";
export const FaceRecognition = () => {
    const [faceEvents, setFaceEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    useEffect(() => {
        const loadFaceEvents = async () => {
            try {
                setLoading(true);
                const data = await apiGetFaceEvents(page, 12);
                setFaceEvents(data.items);
            }
            catch (error) {
                console.error("Failed to load face events:", error);
            }
            finally {
                setLoading(false);
            }
        };
        loadFaceEvents();
    }, [page]);
    if (loading) {
        return _jsx(LoadingSpinner, {});
    }
    const unknownCount = faceEvents.filter((f) => f.matchStatus === "UNKNOWN").length;
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h1", { className: "text-white text-2xl font-bold", children: "Face Recognition" }), _jsxs("div", { className: "text-right", children: [_jsx("p", { className: "text-gray-400 text-sm", children: "Unknown Faces" }), _jsx("p", { className: "text-red-400 text-2xl font-bold", children: unknownCount })] })] }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4", children: faceEvents.map((event) => (_jsxs("div", { className: "border border-gray-700 rounded overflow-hidden hover:border-blue-500 transition", children: [_jsx("div", { className: "bg-gray-800 aspect-square flex items-center justify-center", children: _jsx("img", { src: event.faceImageUrl, alt: "Face", className: "w-full h-full object-cover" }) }), _jsxs("div", { className: "bg-gray-900 p-3 space-y-2 border-t border-gray-700", children: [_jsx("div", { className: `text-xs font-bold ${FACE_MATCH_COLORS[event.matchStatus]}`, children: event.matchStatus }), event.matchedPersonName && (_jsx("div", { children: _jsx("p", { className: "text-white text-xs font-semibold", children: event.matchedPersonName }) })), _jsxs("div", { className: "text-gray-400 text-xs", children: ["Similarity: ", event.similarity, "%"] })] })] }, event.id))) }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("button", { disabled: page === 1, onClick: () => setPage(page - 1), className: "px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white rounded transition", children: "Previous" }), _jsxs("span", { className: "text-gray-400", children: ["Page ", page] }), _jsx("button", { onClick: () => setPage(page + 1), className: "px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded transition", children: "Next" })] })] }));
};
