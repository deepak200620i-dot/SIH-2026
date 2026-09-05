import React, { useState, useEffect } from "react";
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

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem("ibvap-authenticated") === "true"
  );
  const { alerts } = useAlerts();

  if (!isAuthenticated) {
    return <Login onLogin={() => { sessionStorage.setItem("ibvap-authenticated", "true"); setIsAuthenticated(true); }} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell alertCount={alerts.length} />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/live" element={<LiveSurveillance />} />
          <Route path="/cameras" element={<Cameras />} />
          <Route path="/cameras/:cameraId" element={<CameraDetails />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/events" element={<Events />} />
          <Route path="/face-recognition" element={<FaceRecognition />} />
          <Route path="/persons" element={<Persons />} />
          <Route path="/anpr" element={<ANPR />} />
          <Route path="/zones" element={<Zones />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;

