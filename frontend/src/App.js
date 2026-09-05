import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Dashboard } from "@/pages/Dashboard";
import { LiveSurveillance } from "@/pages/LiveSurveillance";
import { Alerts } from "@/pages/Alerts";
import { Events } from "@/pages/Events";
import { FaceRecognition } from "@/pages/FaceRecognition";
import { ANPR } from "@/pages/ANPR";
import { Analytics } from "@/pages/Analytics";
import { Login } from "@/pages/Login";
import { Cameras } from "@/pages/Cameras";
import { CameraDetails } from "@/pages/CameraDetails";
import { Persons } from "@/pages/Persons";
import { Settings } from "@/pages/Settings";
import { useAlerts } from "@/hooks/useAlerts";
import { Zones } from "@/pages/Zones";
export const App = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem("ibvap-authenticated") === "true");
    const { alerts } = useAlerts();
    if (!isAuthenticated) {
        return _jsx(Login, { onLogin: () => { sessionStorage.setItem("ibvap-authenticated", "true"); setIsAuthenticated(true); } });
    }
    return (_jsx(BrowserRouter, { children: _jsx(Routes, { children: _jsxs(Route, { element: _jsx(AppShell, { alertCount: alerts.length }), children: [_jsx(Route, { index: true, element: _jsx(Navigate, { to: "/dashboard", replace: true }) }), _jsx(Route, { path: "/dashboard", element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "/live", element: _jsx(LiveSurveillance, {}) }), _jsx(Route, { path: "/cameras", element: _jsx(Cameras, {}) }), _jsx(Route, { path: "/cameras/:cameraId", element: _jsx(CameraDetails, {}) }), _jsx(Route, { path: "/alerts", element: _jsx(Alerts, {}) }), _jsx(Route, { path: "/events", element: _jsx(Events, {}) }), _jsx(Route, { path: "/face-recognition", element: _jsx(FaceRecognition, {}) }), _jsx(Route, { path: "/persons", element: _jsx(Persons, {}) }), _jsx(Route, { path: "/anpr", element: _jsx(ANPR, {}) }), _jsx(Route, { path: "/zones", element: _jsx(Zones, {}) }), _jsx(Route, { path: "/analytics", element: _jsx(Analytics, {}) }), _jsx(Route, { path: "/settings", element: _jsx(Settings, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/dashboard" }) })] }) }) }));
};
export default App;
